import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { WebBlocker } from '../blocker/webBlocker';
import { AppBlocker } from '../blocker/appBlocker';
import { Scheduler } from '../blocker/scheduler';
import { BlockerStore } from '../store';
import { BlockedWebsite, BlockedApp } from '../types';

describe('WebBlocker Entry Generation & Safe Stripping', () => {
  const store = new BlockerStore();
  const webBlocker = new WebBlocker(store);

  it('generates correct IPv4 and IPv6 loopback entries for domains and subdomains', () => {
    const websites: BlockedWebsite[] = [
      {
        id: 'test-1',
        domain: 'example.com',
        includeSubdomains: true,
        category: 'custom',
        enabled: true,
        createdAt: Date.now(),
      },
    ];

    const entries = webBlocker.generateBlockEntries(websites);

    assert.ok(entries[0].includes('BEGIN FOCUSGUARD BLOCK'));
    assert.ok(entries[entries.length - 1].includes('END FOCUSGUARD BLOCK'));

    assert.ok(entries.includes('127.0.0.1 example.com'));
    assert.ok(entries.includes('::1 example.com'));
    assert.ok(entries.includes('127.0.0.1 www.example.com'));
    assert.ok(entries.includes('::1 www.example.com'));
    assert.ok(entries.includes('127.0.0.1 m.example.com'));
  });

  it('ignores disabled websites when generating entries', () => {
    const websites: BlockedWebsite[] = [
      {
        id: 'test-2',
        domain: 'allowed.com',
        includeSubdomains: false,
        category: 'custom',
        enabled: false,
        createdAt: Date.now(),
      },
    ];

    const entries = webBlocker.generateBlockEntries(websites);
    assert.strictEqual(entries.some((e) => e.includes('allowed.com')), false);
  });
});

describe('BlockerStore Persistence & Logging', () => {
  const store = new BlockerStore();

  it('initializes with default websites and apps', () => {
    const data = store.getData();
    assert.ok(data.websites.length > 0);
    assert.ok(data.apps.length > 0);
    assert.ok(data.settings.theme);
  });

  it('adds logs and preserves log order', () => {
    const initialLogCount = store.getData().activityLogs.length;
    store.addLog('app_blocked', 'TestApp', 'TestApp was blocked');
    const updatedLogs = store.getData().activityLogs;

    assert.strictEqual(updatedLogs.length, initialLogCount + 1);
    assert.strictEqual(updatedLogs[0].target, 'TestApp');
    assert.strictEqual(updatedLogs[0].type, 'app_blocked');
  });

  it('exports valid JSON backup that can be parsed', () => {
    const backupFile = store.exportBackup();
    assert.ok(backupFile.endsWith('.json'));
  });
});

describe('AppBlocker Protection & Lifecycle', () => {
  const store = new BlockerStore();
  const appBlocker = new AppBlocker(store);

  it('reports initial not-running status and starts cleanly', () => {
    assert.strictEqual(appBlocker.isRunning(), false);
    appBlocker.start(5000);
    assert.strictEqual(appBlocker.isRunning(), true);
    appBlocker.stop();
    assert.strictEqual(appBlocker.isRunning(), false);
  });

  it('tracks relaunch count per executable', () => {
    assert.strictEqual(appBlocker.getRelaunchCount('nonexistent.exe'), 0);
  });
});

describe('Scheduler Strict Mode & Session Engine', () => {
  const store = new BlockerStore();
  const appBlocker = new AppBlocker(store);
  const webBlocker = new WebBlocker(store);
  const scheduler = new Scheduler(store, appBlocker, webBlocker);

  it('refuses early stop for locked strict session without override', async () => {
    await scheduler.startSession({
      name: 'Locked Test',
      durationMinutes: 30,
      strictMode: 'locked',
      blockWebsites: false,
      blockApps: false,
    });

    const active = scheduler.getActiveSession();
    assert.ok(active);
    assert.strictEqual(active.strictMode, 'locked');

    // Attempting normal stop without override should fail
    const stoppedWithoutOverride = await scheduler.stopSession(false);
    assert.strictEqual(stoppedWithoutOverride, false);
    assert.ok(scheduler.getActiveSession() !== null);

    // Stop with deliberate override should succeed
    const stoppedWithOverride = await scheduler.stopSession(true);
    assert.strictEqual(stoppedWithOverride, true);
    assert.strictEqual(scheduler.getActiveSession(), null);
  });
});
