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

    scheduler.stopClock();
    appBlocker.stop();
  });

  it('stops focus timer and starts break when switching away from Physics Wallah to non-AI window, and resumes on return', async () => {
    const mockTracker: any = {
      currentAct: {
        pid: 100,
        process: 'chrome',
        title: 'Physics Wallah | Online Courses & Batches',
        url: 'https://study.pw.live/batch/123',
        isPw: true,
        isAi: false,
        isSelf: false,
        isDesktop: false,
      },
      getLatestActivity() {
        return this.currentAct;
      },
      start() {},
      stop() {},
      addListener() { return () => {}; },
    };

    const pwScheduler = new Scheduler(store, appBlocker, webBlocker, mockTracker);

    await pwScheduler.startSession({
      name: 'PW Physics Study',
      durationMinutes: 45,
      strictMode: 'none',
      blockWebsites: false,
      blockApps: false,
      pwLectureMode: true,
    });

    const session = pwScheduler.getActiveSession()!;
    assert.ok(session);
    assert.strictEqual(session.pwLectureMode, true);
    assert.strictEqual(session.isOnBreak, false);

    // Initial tick on Physics Wallah: focus timer runs, no break
    const initialEndTime = session.endTime;
    await (pwScheduler as any).tick();
    assert.strictEqual(session.isOnBreak, false);
    assert.strictEqual(session.currentActivity, 'physics_wallah');
    assert.strictEqual(session.currentBreakSeconds, 0);

    // User switches to ChatGPT (allowed AI assistant) -> timer continues, NOT a break
    mockTracker.currentAct = {
      pid: 101,
      process: 'chrome',
      title: 'Newton Laws of Motion - ChatGPT',
      url: 'https://chatgpt.com',
      isPw: false,
      isAi: true,
      isSelf: false,
      isDesktop: false,
    };
    await (pwScheduler as any).tick();
    assert.strictEqual(session.isOnBreak, false);
    assert.strictEqual(session.currentActivity, 'ai_assistant');
    assert.strictEqual(session.currentBreakSeconds, 0);

    // User switches to Discord / Reddit / Twitter (distraction / off-task) -> BREAK STARTS! Focus timer stops!
    mockTracker.currentAct = {
      pid: 102,
      process: 'Discord',
      title: 'Gaming Voice Chat #general',
      url: '',
      isPw: false,
      isAi: false,
      isSelf: false,
      isDesktop: false,
    };
    const endTimeBeforeBreak = session.endTime;
    await (pwScheduler as any).tick();

    // Session must be in break mode
    assert.strictEqual(session.isOnBreak, true);
    assert.strictEqual(session.currentActivity, 'break');
    assert.strictEqual(session.breakCount, 1);
    assert.strictEqual(session.currentBreakSeconds, 1);
    assert.strictEqual(session.totalBreakSeconds, 1);
    // Focus timer was frozen by extending endTime by 1000ms
    assert.strictEqual(session.endTime, endTimeBeforeBreak + 1000);

    // Another second on Discord -> break timer increments, focus timer stays stopped
    await (pwScheduler as any).tick();
    assert.strictEqual(session.currentBreakSeconds, 2);
    assert.strictEqual(session.totalBreakSeconds, 2);
    assert.strictEqual(session.endTime, endTimeBeforeBreak + 2000);

    // User switches BACK to Physics Wallah lecture -> BREAK ENDS, FOCUS TIMER RESUMES!
    mockTracker.currentAct = {
      pid: 100,
      process: 'chrome',
      title: 'Rotational Motion Lecture 02 - Physics Wallah',
      url: 'https://www.pw.live',
      isPw: true,
      isAi: false,
      isSelf: false,
      isDesktop: false,
    };
    const endTimeAtResume = session.endTime;
    await (pwScheduler as any).tick();

    assert.strictEqual(session.isOnBreak, false);
    assert.strictEqual(session.currentActivity, 'physics_wallah');
    assert.strictEqual(session.currentBreakSeconds, 0);
    assert.strictEqual(session.totalBreakSeconds, 2); // Preserves accumulated break time
    // Timer is active again, endTime is not extended
    assert.strictEqual(session.endTime, endTimeAtResume);

    await pwScheduler.stopSession(true);
    pwScheduler.stopClock();
    appBlocker.stop();
  });
});
