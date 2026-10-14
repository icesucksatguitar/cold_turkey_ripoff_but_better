import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BlockedWebsite } from '../types';
import { BlockerStore } from '../store';

const execAsync = promisify(exec);

const HOSTS_FILE_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const BLOCK_START_MARKER = '# BEGIN FOCUSGUARD BLOCK';
const BLOCK_END_MARKER = '# END FOCUSGUARD BLOCK';

export interface WebBlockResult {
  success: boolean;
  requiresElevation: boolean;
  message: string;
}

export class WebBlocker {
  private store: BlockerStore;

  constructor(store: BlockerStore) {
    this.store = store;
  }

  public getHostsFilePath(): string {
    return HOSTS_FILE_PATH;
  }

  /**
   * Check if current process has direct write access to hosts file
   */
  public hasDirectWriteAccess(): boolean {
    try {
      if (!fs.existsSync(HOSTS_FILE_PATH)) {
        return false;
      }
      fs.accessSync(HOSTS_FILE_PATH, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if FocusGuard block rules currently exist in hosts file
   */
  public isBlockActiveInHosts(): boolean {
    try {
      if (!fs.existsSync(HOSTS_FILE_PATH)) return false;
      const content = fs.readFileSync(HOSTS_FILE_PATH, 'utf-8');
      return content.includes(BLOCK_START_MARKER);
    } catch {
      return false;
    }
  }

  /**
   * Backup current hosts file
   */
  public backupHostsFile(): string | null {
    try {
      if (!fs.existsSync(HOSTS_FILE_PATH)) return null;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = this.store.getBackupDir();
      const backupPath = path.join(backupDir, `hosts_backup_${timestamp}.txt`);
      fs.copyFileSync(HOSTS_FILE_PATH, backupPath);
      return backupPath;
    } catch (err) {
      console.error('Failed to backup hosts file:', err);
      return null;
    }
  }

  /**
   * Generates the list of host-line entries for given domains
   */
  public generateBlockEntries(websites: BlockedWebsite[]): string[] {
    const domainSet = new Set<string>();

    for (const item of websites) {
      if (!item.enabled) continue;
      const clean = item.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!clean) continue;

      domainSet.add(clean);

      if (item.includeSubdomains) {
        domainSet.add(`www.${clean}`);
        domainSet.add(`m.${clean}`);
        domainSet.add(`mobile.${clean}`);
        domainSet.add(`api.${clean}`);
        domainSet.add(`web.${clean}`);
        domainSet.add(`touch.${clean}`);
      }

      // Add common domain aliases and CDNs for major distractors
      if (clean === 'youtube.com') {
        domainSet.add('youtu.be');
        domainSet.add('www.youtu.be');
        domainSet.add('m.youtu.be');
        domainSet.add('music.youtube.com');
        domainSet.add('gaming.youtube.com');
        domainSet.add('youtube-nocookie.com');
        domainSet.add('www.youtube-nocookie.com');
      } else if (clean === 'x.com' || clean === 'twitter.com') {
        domainSet.add('x.com');
        domainSet.add('www.x.com');
        domainSet.add('twitter.com');
        domainSet.add('www.twitter.com');
        domainSet.add('mobile.twitter.com');
        domainSet.add('t.co');
      } else if (clean === 'reddit.com') {
        domainSet.add('reddit.com');
        domainSet.add('www.reddit.com');
        domainSet.add('old.reddit.com');
        domainSet.add('new.reddit.com');
        domainSet.add('redd.it');
        domainSet.add('v.redd.it');
        domainSet.add('i.redd.it');
      } else if (clean === 'instagram.com') {
        domainSet.add('instagram.com');
        domainSet.add('www.instagram.com');
        domainSet.add('m.instagram.com');
        domainSet.add('l.instagram.com');
      } else if (clean === 'facebook.com') {
        domainSet.add('facebook.com');
        domainSet.add('www.facebook.com');
        domainSet.add('m.facebook.com');
        domainSet.add('fb.com');
      } else if (clean === 'tiktok.com') {
        domainSet.add('tiktok.com');
        domainSet.add('www.tiktok.com');
        domainSet.add('m.tiktok.com');
      } else if (clean === 'twitch.tv') {
        domainSet.add('twitch.tv');
        domainSet.add('www.twitch.tv');
        domainSet.add('m.twitch.tv');
      }
    }

    // Always neutralize DNS-over-HTTPS (DoH) so Chrome and Edge fall back to the hosts file
    if (domainSet.size > 0) {
      const dohDomains = [
        'cloudflare-dns.com',
        'dns.google',
        'dns.google.com',
        'dns.quad9.net',
        'doh.opendns.com',
        'dns.adguard.com',
        'chrome.cloudflare-dns.com',
        'mozilla.cloudflare-dns.com',
      ];
      for (const d of dohDomains) {
        domainSet.add(d);
      }
    }

    const lines: string[] = [];
    lines.push(BLOCK_START_MARKER);
    lines.push('# Automatically managed by FocusGuard. Do not edit manually.');
    lines.push(`# Generated at: ${new Date().toISOString()}`);

    for (const domain of Array.from(domainSet).sort()) {
      lines.push(`127.0.0.1 ${domain}`);
      lines.push(`::1 ${domain}`);
    }

    lines.push(BLOCK_END_MARKER);
    return lines;
  }

  /**
   * Apply website block entries to the hosts file
   */
  public async applyBlock(websites: BlockedWebsite[]): Promise<WebBlockResult> {
    const backupPath = this.backupHostsFile();
    if (backupPath) {
      this.store.addLog('system', 'Hosts', `Created hosts backup at ${path.basename(backupPath)}`);
    }

    try {
      const existing = fs.readFileSync(HOSTS_FILE_PATH, 'utf-8');
      // Strip any previous block first to ensure clean state
      const cleaned = this.stripExistingBlock(existing);

      const blockLines = this.generateBlockEntries(websites);
      // If no websites are active, we just write cleaned hosts
      const newContent = websites.some((w) => w.enabled)
        ? `${cleaned.trimEnd()}\r\n\r\n${blockLines.join('\r\n')}\r\n`
        : `${cleaned.trimEnd()}\r\n`;

      return await this.writeHostsFile(newContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        requiresElevation: true,
        message: `Could not read/write hosts file: ${msg}`,
      };
    }
  }

  /**
   * Safely remove FocusGuard block rules and restore original hosts file
   */
  public async removeBlock(): Promise<WebBlockResult> {
    try {
      if (!fs.existsSync(HOSTS_FILE_PATH)) {
        return { success: true, requiresElevation: false, message: 'Hosts file not found' };
      }

      const existing = fs.readFileSync(HOSTS_FILE_PATH, 'utf-8');
      if (!existing.includes(BLOCK_START_MARKER)) {
        return { success: true, requiresElevation: false, message: 'No FocusGuard block rules present' };
      }

      this.backupHostsFile();
      const cleaned = this.stripExistingBlock(existing);
      return await this.writeHostsFile(`${cleaned.trimEnd()}\r\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        requiresElevation: true,
        message: `Failed to remove block: ${msg}`,
      };
    }
  }

  /**
   * Helper to strip our section without touching any other lines
   */
  private stripExistingBlock(content: string): string {
    const startIndex = content.indexOf(BLOCK_START_MARKER);
    if (startIndex === -1) return content;

    const endIndex = content.indexOf(BLOCK_END_MARKER);
    if (endIndex === -1) {
      // Incomplete marker: strip from start to end of file
      return content.substring(0, startIndex);
    }

    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + BLOCK_END_MARKER.length);
    return (before + after).replace(/\r\n\r\n\r\n+/g, '\r\n\r\n');
  }

  /**
   * Write content to hosts file directly if permitted, or prompt with elevated batch execution
   */
  private async writeHostsFile(content: string): Promise<WebBlockResult> {
    if (this.hasDirectWriteAccess()) {
      try {
        fs.writeFileSync(HOSTS_FILE_PATH, content, 'utf-8');
        await this.flushDns();
        return { success: true, requiresElevation: false, message: 'Hosts file updated successfully' };
      } catch (e: unknown) {
        console.warn('Direct write failed despite access check, falling back to elevated script:', e);
      }
    }

    // Prepare temporary script file to execute with UAC elevation
    const tempDir = this.store.getDataDir();
    const tempHostsFile = path.join(tempDir, 'hosts_pending.tmp');
    const tempBatFile = path.join(tempDir, 'update_hosts.bat');

    try {
      fs.writeFileSync(tempHostsFile, content, 'utf-8');

      // Robust batch script that copies pending hosts to Windows drivers/etc/hosts
      const batContent = `@echo off
copy /y "${tempHostsFile}" "C:\\Windows\\System32\\drivers\\etc\\hosts" >nul
ipconfig /flushdns >nul
del "${tempHostsFile}" 2>nul
exit /b 0
`;
      fs.writeFileSync(tempBatFile, batContent, 'utf-8');

      // Trigger UAC elevation prompt
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \\"${tempBatFile}\\"' -Verb RunAs -Wait -WindowStyle Hidden"`;
      await execAsync(cmd, { timeout: 15000 });

      // Clean up script
      try {
        if (fs.existsSync(tempBatFile)) fs.unlinkSync(tempBatFile);
        if (fs.existsSync(tempHostsFile)) fs.unlinkSync(tempHostsFile);
      } catch {}

      await this.flushDns();

      return {
        success: true,
        requiresElevation: true,
        message: 'Hosts file updated with Administrator elevation',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        requiresElevation: true,
        message: `Elevation request declined or failed: ${msg}`,
      };
    }
  }

  /**
   * Flush Windows DNS cache
   */
  public async flushDns(): Promise<void> {
    try {
      await execAsync('ipconfig /flushdns', { timeout: 3000 });
    } catch (e) {
      console.warn('Failed to flush DNS cache:', e);
    }
  }
}
