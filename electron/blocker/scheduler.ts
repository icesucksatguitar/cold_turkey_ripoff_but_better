import { ActiveSession, FocusSchedule, StrictModeLevel } from '../types';
import { BlockerStore } from '../store';
import { AppBlocker } from './appBlocker';
import { WebBlocker } from './webBlocker';

export interface SchedulerEvents {
  onSessionUpdated: (session: ActiveSession | null) => void;
  onTimeTick: (timeRemainingSeconds: number) => void;
  onNotificationRequest: (title: string, body: string) => void;
}

export class Scheduler {
  private store: BlockerStore;
  private appBlocker: AppBlocker;
  private webBlocker: WebBlocker;
  private timer: NodeJS.Timeout | null = null;
  private events?: SchedulerEvents;
  private lastCheckedMinute = -1;

  constructor(store: BlockerStore, appBlocker: AppBlocker, webBlocker: WebBlocker) {
    this.store = store;
    this.appBlocker = appBlocker;
    this.webBlocker = webBlocker;
  }

  public setEvents(events: SchedulerEvents) {
    this.events = events;
  }

  /**
   * Initializes scheduler and recovers from restart/sleep/hibernation
   */
  public async init(): Promise<void> {
    const data = this.store.getData();
    const active = data.activeSession;

    if (active) {
      const now = Date.now();
      if (now >= active.endTime) {
        // Session ended while app was closed or computer slept
        this.store.addLog('session_end', active.name, 'Session expired while offline.');
        data.activeSession = null;
        this.store.persist();
        await this.webBlocker.removeBlock();
      } else {
        // Resume session
        this.store.addLog('session_start', active.name, 'Resumed active focus session on startup.');
        await this.enforceSessionStart(active);
      }
    } else {
      // Re-apply enabled websites on startup for 24/7 protection
      const enabledWebsites = data.websites.filter((w) => w.enabled);
      if (enabledWebsites.length > 0) {
        await this.webBlocker.applyBlock(data.websites);
      } else if (this.webBlocker.isBlockActiveInHosts()) {
        await this.webBlocker.removeBlock();
      }
    }

    this.startClock();
  }

  private startClock() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('Error during scheduler tick:', err));
    }, 1000);
  }

  public stopClock() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Main 1-second tick loop
   */
  private async tick(): Promise<void> {
    const data = this.store.getData();
    const session = data.activeSession;
    const now = Date.now();

    if (session) {
      if (session.isPaused) {
        // Paused session does not decrement remaining time
        if (this.events) {
          const remainingSec = Math.max(0, Math.round((session.pausedTimeRemainingMs || 0) / 1000));
          this.events.onTimeTick(remainingSec);
        }
        return;
      }

      const diffMs = session.endTime - now;
      const remainingSec = Math.max(0, Math.round(diffMs / 1000));

      if (this.events) {
        this.events.onTimeTick(remainingSec);
      }

      if (diffMs <= 0) {
        await this.completeSession(session);
      }
    } else {
      // Check recurring schedules once a minute
      const currentMinute = new Date().getMinutes();
      if (currentMinute !== this.lastCheckedMinute) {
        this.lastCheckedMinute = currentMinute;
        await this.checkRecurringSchedules();
      }
    }
  }

  /**
   * Check if any enabled schedule matches current day & time
   */
  private async checkRecurringSchedules(): Promise<void> {
    const data = this.store.getData();
    if (data.activeSession) return; // Do not interrupt an active session

    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${mins}`;

    for (const schedule of data.schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      // If current time is within schedule window [startTime, endTime)
      if (currentTimeStr >= schedule.startTime && currentTimeStr < schedule.endTime) {
        // Calculate duration until endTime
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const endToday = new Date(now);
        endToday.setHours(endH, endM, 0, 0);

        const durationMinutes = Math.max(1, Math.round((endToday.getTime() - now.getTime()) / (60 * 1000)));

        this.store.addLog(
          'schedule_trigger',
          schedule.name,
          `Schedule activated automatically (${schedule.startTime} - ${schedule.endTime})`
        );

        await this.startSession({
          name: schedule.name,
          durationMinutes,
          strictMode: schedule.strictMode,
          blockWebsites: schedule.blockWebsites,
          blockApps: schedule.blockApps,
          preset: schedule.presetName,
          source: 'schedule',
        });
        break;
      }
    }
  }

  /**
   * Start a new focus session
   */
  public async startSession(params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
    source?: 'manual' | 'schedule';
  }): Promise<ActiveSession> {
    const now = Date.now();
    const durationMs = params.durationMinutes * 60 * 1000;
    const endTime = now + durationMs;

    const session: ActiveSession = {
      id: `session-${now}`,
      name: params.name || 'Focus Session',
      startTime: now,
      durationMinutes: params.durationMinutes,
      endTime,
      strictMode: params.strictMode,
      isPaused: false,
      preset: params.preset,
      blockWebsites: params.blockWebsites,
      blockApps: params.blockApps,
      source: params.source || 'manual',
    };

    const data = this.store.getData();
    data.activeSession = session;
    this.store.persist();

    this.store.addLog(
      'session_start',
      session.name,
      `Focus session started for ${params.durationMinutes} minutes. Strict: ${params.strictMode}`
    );

    await this.enforceSessionStart(session);

    if (this.events) {
      this.events.onSessionUpdated(session);
      this.events.onNotificationRequest(
        'Focus Session Started',
        `Focusing for ${params.durationMinutes} minutes. Distractions blocked!`
      );
    }

    return session;
  }

  /**
   * Pause session (only allowed if strictMode is 'none')
   */
  public pauseSession(): boolean {
    const data = this.store.getData();
    const session = data.activeSession;
    if (!session || session.strictMode !== 'none') return false;

    session.isPaused = true;
    session.pausedTimeRemainingMs = Math.max(0, session.endTime - Date.now());
    this.store.persist();

    // Temporarily disable blockers while paused
    this.appBlocker.stop();
    this.webBlocker.removeBlock().catch(() => {});

    if (this.events) {
      this.events.onSessionUpdated(session);
    }
    return true;
  }

  /**
   * Resume paused session
   */
  public async resumeSession(): Promise<boolean> {
    const data = this.store.getData();
    const session = data.activeSession;
    if (!session || !session.isPaused) return false;

    const remaining = session.pausedTimeRemainingMs || session.durationMinutes * 60 * 1000;
    session.isPaused = false;
    session.endTime = Date.now() + remaining;
    delete session.pausedTimeRemainingMs;
    this.store.persist();

    await this.enforceSessionStart(session);

    if (this.events) {
      this.events.onSessionUpdated(session);
    }
    return true;
  }

  /**
   * Stop session prematurely
   */
  public async stopSession(overridePassword = false): Promise<boolean> {
    const data = this.store.getData();
    const session = data.activeSession;
    if (!session) return true;

    // Strict mode check: cannot stop unless override authorized
    if (session.strictMode !== 'none' && !overridePassword) {
      return false;
    }

    this.store.addLog(
      overridePassword ? 'emergency_unlock' : 'session_end',
      session.name,
      overridePassword ? 'Session ended via emergency unlock phrase.' : 'Session stopped early by user.'
    );

    await this.enforceSessionStop();

    data.activeSession = null;
    this.store.persist();

    if (this.events) {
      this.events.onSessionUpdated(null);
      this.events.onNotificationRequest('Session Ended', 'Focus session stopped.');
    }

    return true;
  }

  /**
   * Natural session completion
   */
  private async completeSession(session: ActiveSession): Promise<void> {
    this.store.addLog('session_end', session.name, `Session completed successfully (${session.durationMinutes}m)!`);

    await this.enforceSessionStop();

    const data = this.store.getData();
    data.activeSession = null;
    this.store.persist();

    if (this.events) {
      this.events.onSessionUpdated(null);
      this.events.onNotificationRequest(
        'Session Completed! 🎉',
        `Great job! You stayed focused for ${session.durationMinutes} minutes.`
      );
    }
  }

  private async enforceSessionStart(session: ActiveSession): Promise<void> {
    const data = this.store.getData();

    if (session.blockApps) {
      this.appBlocker.start(data.settings.appBlockIntervalMs || 1000);
    }

    if (session.blockWebsites) {
      await this.webBlocker.applyBlock(data.websites);
    }
  }

  private async enforceSessionStop(): Promise<void> {
    const data = this.store.getData();
    const hasBlockedApps = data.apps.some((a) => a.enabled);
    if (hasBlockedApps) {
      this.appBlocker.start(data.settings.appBlockIntervalMs || 800);
    } else {
      this.appBlocker.stop();
    }

    const enabledWebsites = data.websites.filter((w) => w.enabled);
    if (enabledWebsites.length > 0) {
      await this.webBlocker.applyBlock(data.websites);
    } else {
      await this.webBlocker.removeBlock();
    }
  }

  public getActiveSession(): ActiveSession | null {
    return this.store.getData().activeSession;
  }
}
