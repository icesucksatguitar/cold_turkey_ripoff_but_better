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
   * Write content to hosts file directly if permitted, or prompt with elevated PowerShell
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
    const tempPsScript = path.join(tempDir, 'elevated_hosts_update.ps1');

    try {
      fs.writeFileSync(tempHostsFile, content, 'utf-8');

      // Safe PowerShell script that writes the prepared file to system32 hosts and flushes DNS
      const psScriptContent = `
$target = "C:\\Windows\\System32\\drivers\\etc\\hosts"
$source = "${tempHostsFile.replace(/\\/g, '\\\\')}"
if (Test-Path $source) {
    Copy-Item -Path $source -Destination $target -Force
    Remove-Item -Path $source -Force -ErrorAction SilentlyContinue
    ipconfig /flushdns | Out-Null
}
`;
      fs.writeFileSync(tempPsScript, psScriptContent, 'utf-8');

      // Trigger UAC elevation prompt
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"${tempPsScript}\\"' -Verb RunAs -Wait"`;
      await execAsync(cmd, { timeout: 15000 });

      // Clean up script
      try {
        if (fs.existsSync(tempPsScript)) fs.unlinkSync(tempPsScript);
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
