import { ActiveSession, FocusSchedule, StrictModeLevel } from '../types';
import { BlockerStore } from '../store';
import { AppBlocker } from './appBlocker';
import { WebBlocker } from './webBlocker';
import { WindowActivityTracker } from './windowTracker';

export interface SchedulerEvents {
  onSessionUpdated: (session: ActiveSession | null) => void;
  onTimeTick: (timeRemainingSeconds: number) => void;
  onNotificationRequest: (title: string, body: string) => void;
}

export class Scheduler {
  private store: BlockerStore;
  private appBlocker: AppBlocker;
  private webBlocker: WebBlocker;
  private activityTracker: WindowActivityTracker;
  private timer: NodeJS.Timeout | null = null;
  private events?: SchedulerEvents;
  private lastCheckedMinute = -1;

  constructor(
    store: BlockerStore,
    appBlocker: AppBlocker,
    webBlocker: WebBlocker,
    activityTracker?: WindowActivityTracker
  ) {
    this.store = store;
    this.appBlocker = appBlocker;
    this.webBlocker = webBlocker;
    this.activityTracker = activityTracker || new WindowActivityTracker();
  }

  public setEvents(events: SchedulerEvents) {
    this.events = events;
  }

  public getActivityTracker(): WindowActivityTracker {
    return this.activityTracker;
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
    this.activityTracker.stop();
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

      // Physics Wallah Lecture Mode handling:
      // If user is watching PW lecture / on PW site: Focus timer runs.
      // If user switches to ChatGPT, Claude, or Gemini: Focus timer continues running (AI assistant allowed).
      // If user switches to ANYTHING ELSE: Focus timer STOPS and counts as a break until user switches back!
      if (session.pwLectureMode) {
        const activity = this.activityTracker.getLatestActivity();
        if (activity) {
          if (activity.isPw) {
            // User is actively on Physics Wallah!
            if (session.isOnBreak) {
              const breakSecs = session.currentBreakSeconds || 0;
              const breakM = Math.floor(breakSecs / 60);
              const breakS = breakSecs % 60;
              const durStr = breakM > 0 ? `${breakM}m ${breakS}s` : `${breakS}s`;

              this.store.addLog(
                'break_end',
                'Physics Wallah',
                `Returned to Physics Wallah after ${durStr} break. Focus timer resumed.`
              );
              session.isOnBreak = false;
              session.currentBreakSeconds = 0;

              if (this.events) {
                this.events.onNotificationRequest(
                  'Focus Resumed 🎯',
                  `Back on Physics Wallah! Focus timer is running again.`
                );
              }
            }
            session.currentActivity = 'physics_wallah';
            session.activeWindowTitle = activity.title;
            session.activeProcessName = activity.process;
          } else if (activity.isAi) {
            // User is using ChatGPT, Claude, or Gemini (allowed study assistant)
            if (session.isOnBreak) {
              const breakSecs = session.currentBreakSeconds || 0;
              const breakM = Math.floor(breakSecs / 60);
              const breakS = breakSecs % 60;
              const durStr = breakM > 0 ? `${breakM}m ${breakS}s` : `${breakS}s`;

              this.store.addLog(
                'break_end',
                activity.title || activity.process,
                `Switched to AI assistant after ${durStr} break. Focus timer resumed.`
              );
              session.isOnBreak = false;
              session.currentBreakSeconds = 0;
            }
            session.currentActivity = 'ai_assistant';
            session.activeWindowTitle = activity.title;
            session.activeProcessName = activity.process;
          } else if (activity.isSelf) {
            // FocusGuard window itself is neutral (allows user to check timer/stats)
            session.currentActivity = session.currentActivity || 'neutral';
          } else {
            // Off-task window/tab: NOT Physics Wallah and NOT AI -> COUNT AS BREAK & STOP FOCUS TIMER
            if (!session.isOnBreak) {
              session.isOnBreak = true;
              session.breakCount = (session.breakCount || 0) + 1;
              session.currentBreakSeconds = 0;

              const target = activity.title || activity.process || 'Off-task window';
              this.store.addLog(
                'break_start',
                target,
                `Switched away from Physics Wallah to "${target}". Focus timer stopped, break active.`
              );

              const shouldNotify = data.settings.notifyOnBreak ?? true;
              if (shouldNotify && this.events) {
                const titleSnippet = activity.title
                  ? activity.title.slice(0, 35) + (activity.title.length > 35 ? '...' : '')
                  : activity.process;
                this.events.onNotificationRequest(
                  'Off-Task Break Started ⏸️',
                  `Switched to ${titleSnippet}. Focus timer paused until you return to Physics Wallah or AI.`
                );
              }
            }

            session.currentActivity = 'break';
            session.activeWindowTitle = activity.title;
            session.activeProcessName = activity.process;

            // Increment break time counters
            session.currentBreakSeconds = (session.currentBreakSeconds || 0) + 1;
            session.totalBreakSeconds = (session.totalBreakSeconds || 0) + 1;

            // Freeze focus countdown by extending endTime by 1000ms
            session.endTime += 1000;
          }
        }
      }

      const diffMs = session.endTime - now;
      const remainingSec = Math.max(0, Math.round(diffMs / 1000));

      if (this.events) {
        this.events.onTimeTick(remainingSec);
        this.events.onSessionUpdated(session);
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
    pwLectureMode?: boolean;
  }): Promise<ActiveSession> {
    const now = Date.now();
    const durationMs = params.durationMinutes * 60 * 1000;
    const endTime = now + durationMs;

    const data = this.store.getData();
    const pwLectureMode =
      params.pwLectureMode !== undefined
        ? params.pwLectureMode
        : (data.settings.pwLectureModeDefault ?? true);

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
      pwLectureMode,
      isOnBreak: false,
      currentBreakSeconds: 0,
      totalBreakSeconds: 0,
      breakCount: 0,
      currentActivity: pwLectureMode ? 'physics_wallah' : undefined,
    };

    data.activeSession = session;
    this.store.persist();

    const modeDesc = pwLectureMode
      ? ' (Physics Wallah lecture detection & AI assistant active)'
      : '';

    this.store.addLog(
      'session_start',
      session.name,
      `Focus session started for ${params.durationMinutes} minutes. Strict: ${params.strictMode}${modeDesc}`
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
    this.activityTracker.stop();

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

    const breakSummary = session.totalBreakSeconds
      ? ` Total break: ${Math.round(session.totalBreakSeconds / 60)}m (${session.breakCount || 0} breaks).`
      : '';

    this.store.addLog(
      overridePassword ? 'emergency_unlock' : 'session_end',
      session.name,
      overridePassword
        ? `Session ended via emergency unlock phrase.${breakSummary}`
        : `Session stopped early by user.${breakSummary}`
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
    const breakSummary = session.totalBreakSeconds
      ? ` Total break time: ${Math.round(session.totalBreakSeconds / 60)}m (${session.breakCount || 0} breaks).`
      : '';

    this.store.addLog(
      'session_end',
      session.name,
      `Session completed successfully (${session.durationMinutes}m)!${breakSummary}`
    );

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

    if (session.pwLectureMode) {
      this.activityTracker.start(900);
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

    this.activityTracker.stop();
  }

  public getActiveSession(): ActiveSession | null {
    return this.store.getData().activeSession;
  }
}
