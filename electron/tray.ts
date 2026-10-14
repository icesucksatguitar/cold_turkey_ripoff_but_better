import { Menu, Tray, nativeImage } from 'electron';
import { ActiveSession } from './types';

export interface TrayCallbacks {
  onShowApp: () => void;
  onQuickStart: (minutes: number) => void;
  onPauseResume: () => void;
  onEmergencyStop: () => void;
  onRestoreHosts: () => void;
  onQuit: () => void;
}

export class AppTray {
  private tray: Tray | null = null;
  private callbacks: TrayCallbacks;
  private currentSession: ActiveSession | null = null;
  private timeRemainingText = '';

  constructor(callbacks: TrayCallbacks) {
    this.callbacks = callbacks;
  }

  public init() {
    // Generate a clean 16x16 icon in memory (shield/lock pixel icon)
    const icon = this.createDefaultIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('FocusGuard - Local Windows Productivity Blocker');

    this.tray.on('double-click', () => {
      this.callbacks.onShowApp();
    });

    this.updateMenu();
  }

  public updateSession(session: ActiveSession | null) {
    this.currentSession = session;
    this.updateMenu();
  }

  public updateTime(remainingSeconds: number) {
    if (this.currentSession) {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      this.timeRemainingText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      if (this.tray) {
        this.tray.setToolTip(`FocusGuard - Active: ${this.timeRemainingText} left`);
      }
    } else {
      this.timeRemainingText = '';
      if (this.tray) {
        this.tray.setToolTip('FocusGuard - Idle');
      }
    }
  }

  public updateMenu() {
    if (!this.tray) return;

    const isSessionActive = !!this.currentSession;
    const isStrict = this.currentSession && this.currentSession.strictMode !== 'none';
    const isPaused = this.currentSession?.isPaused || false;

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: isSessionActive
          ? `Status: Focusing (${this.timeRemainingText || 'Active'})`
          : 'Status: Idle',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open FocusGuard',
        click: () => this.callbacks.onShowApp(),
      },
    ];

    if (!isSessionActive) {
      template.push({
        label: 'Quick 25m Focus Session',
        click: () => this.callbacks.onQuickStart(25),
      });
      template.push({
        label: 'Quick 50m Deep Work',
        click: () => this.callbacks.onQuickStart(50),
      });
    } else {
      if (!isStrict) {
        template.push({
          label: isPaused ? 'Resume Session' : 'Pause Session',
          click: () => this.callbacks.onPauseResume(),
        });
      }
      template.push({
        label: isStrict ? 'Emergency Unlock...' : 'End Focus Session',
        click: () => this.callbacks.onEmergencyStop(),
      });
    }

    template.push({ type: 'separator' });
    template.push({
      label: 'Emergency Restore Hosts File',
      click: () => this.callbacks.onRestoreHosts(),
    });
    template.push({
      label: 'Exit Application',
      click: () => this.callbacks.onQuit(),
    });

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }

  public destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private createDefaultIcon(): Electron.NativeImage {
    // 16x16 RGBA cyan-blue shield icon buffer
    const size = 16;
    const buffer = Buffer.alloc(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Shield shape outline
        const inShield = x >= 2 && x <= 13 && y >= 2 && y <= (14 - Math.abs(x - 7.5));
        if (inShield) {
          buffer[idx] = 14;     // R
          buffer[idx + 1] = 165; // G
          buffer[idx + 2] = 233; // B (sky blue #0ea5e9)
          buffer[idx + 3] = 255; // Alpha
        } else {
          buffer[idx + 3] = 0;   // Transparent
        }
      }
    }

    return nativeImage.createFromBuffer(buffer, { width: size, height: size });
  }
}
