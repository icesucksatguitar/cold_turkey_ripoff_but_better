import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Search,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  FileCode,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { BlockedWebsite } from '../types';

interface WebsiteBlockerProps {
  websites: BlockedWebsite[];
  onAddWebsite: (domain: string, category: BlockedWebsite['category'], includeSubdomains: boolean) => void;
  onToggleWebsite: (id: string) => void;
  onRemoveWebsite: (id: string) => void;
  onBlockAllWebsites?: () => void;
  onUnblockAllWebsites?: () => void;
}

export const WebsiteBlocker: React.FC<WebsiteBlockerProps> = ({
  websites,
  onAddWebsite,
  onToggleWebsite,
  onRemoveWebsite,
  onBlockAllWebsites,
  onUnblockAllWebsites,
}) => {
  const [newDomain, setNewDomain] = useState('');
  const [newCategory, setNewCategory] = useState<BlockedWebsite['category']>('entertainment');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    onAddWebsite(newDomain, newCategory, includeSubdomains);
    setNewDomain('');
    if (window.focusGuardApi && window.focusGuardApi.applyHostsBlock) {
      window.focusGuardApi.applyHostsBlock().catch(() => {});
    }
  };

  const handleToggle = (id: string) => {
    onToggleWebsite(id);
    if (window.focusGuardApi && window.focusGuardApi.applyHostsBlock) {
      window.focusGuardApi.applyHostsBlock().catch(() => {});
    }
  };

  const handleRemove = (id: string) => {
    onRemoveWebsite(id);
    if (window.focusGuardApi && window.focusGuardApi.applyHostsBlock) {
      window.focusGuardApi.applyHostsBlock().catch(() => {});
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    if (window.focusGuardApi && window.focusGuardApi.applyHostsBlock) {
      try {
        const res = await window.focusGuardApi.applyHostsBlock();
        setSyncStatusMsg(res.message || 'Hosts updated & DNS flushed.');
      } catch (err) {
        setSyncStatusMsg('Error syncing hosts file.');
      }
    } else {
      setSyncStatusMsg('DNS cache flushed (simulation).');
    }
    setTimeout(() => setSyncStatusMsg(null), 4000);
    setIsSyncing(false);
  };

  const handleImportSubmit = () => {
    const lines = importText
      .split(/[\r\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines) {
      onAddWebsite(line, 'custom', true);
    }
    setImportText('');
    setShowImportModal(false);
  };

  const handleExport = () => {
    const content = websites.map((w) => w.domain).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focusguard_blocklist_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered websites
  const filteredWebsites = websites.filter((w) => {
    const matchesSearch = w.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' || w.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            DNS Loopback Layer
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Globe className="text-white" size={24} />
            Website Blocker
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Redirects distracting domains and subdomains to local loopback (127.0.0.1 / ::1).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="btn-secondary text-xs"
            title="Inspect generated hosts lines"
          >
            <Eye size={13} />
            Inspect Hosts
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-xs"
            title="Import domains"
          >
            <Upload size={13} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary text-xs"
            title="Export block list"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Website Protection Status & Control Card */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white text-black flex items-center justify-center font-bold shrink-0">
            <Globe size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span>Windows Loopback DNS Blocker</span>
              <span className="px-1.5 py-0.5 rounded bg-white text-black text-[10px] font-bold font-mono">
                {websites.filter((w) => w.enabled).length} ACTIVE
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Domains redirect to 127.0.0.1 & ::1. Secure DNS (DoH) is neutralized for Chrome, Edge & Brave.
            </div>
            {syncStatusMsg && (
              <div className="text-[11px] font-mono text-zinc-200 mt-1 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-white" />
                <span>{syncStatusMsg}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="btn-secondary text-xs font-mono"
            title="Re-write hosts rules and flush Windows DNS cache"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Flushing DNS...' : 'Flush DNS & Re-Sync'}</span>
          </button>

          {onBlockAllWebsites && (
            <button
              onClick={onBlockAllWebsites}
              className="btn-primary text-xs font-mono font-bold"
              title="Block all configured domains"
            >
              <ShieldAlert size={13} />
              <span>BLOCK ALL</span>
            </button>
          )}

          {onUnblockAllWebsites && (
            <button
              onClick={onUnblockAllWebsites}
              className="btn-secondary text-xs font-mono"
              title="Temporarily unblock all domains"
            >
              <ShieldCheck size={13} />
              <span>ALLOW ALL</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Domain Form Card */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-white/10">
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Enter domain (e.g. youtube.com, reddit.com, x.com)"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="input-field text-xs font-mono"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as BlockedWebsite['category'])}
                className="input-field text-xs cursor-pointer"
              >
                <option value="entertainment">Entertainment</option>
                <option value="social">Social Media</option>
                <option value="gaming">Gaming & Streams</option>
                <option value="news">News & Media</option>
                <option value="custom">Custom / Other</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <label className="text-xs text-zinc-400 cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeSubdomains}
                  onChange={(e) => setIncludeSubdomains(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 accent-white w-4 h-4 cursor-pointer"
                />
                <span>Subdomains</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="btn-primary w-full justify-center text-xs">
                <Plus size={14} />
                <span>Add Domain</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search & Categories Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3.5 top-3 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search domain rules..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950 border border-white/10 w-full md:w-auto">
          {['all', 'social', 'entertainment', 'gaming', 'news', 'custom'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-colors ${
                selectedCategoryFilter === cat
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Cards List */}
      <div className="space-y-2">
        {filteredWebsites.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-950 border border-white/10">
            <Globe size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-white">No domains in this category</p>
            <p className="text-xs text-zinc-500 mt-1">Add a new domain above to block distracting sites.</p>
          </div>
        ) : (
          filteredWebsites.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                item.enabled
                  ? 'bg-zinc-900/90 border-white/30 shadow-md'
                  : 'bg-zinc-950/60 border-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                    item.enabled ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 border border-white/10'
                  }`}
                >
                  {item.domain.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate font-mono">{item.domain}</span>
                    {item.enabled ? (
                      <span className="badge badge-blocked">BLOCKED</span>
                    ) : (
                      <span className="badge badge-idle">OFF</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mt-0.5">
                    <span className="uppercase">{item.category}</span>
                    {item.includeSubdomains && (
                      <span className="text-[10px] text-zinc-400">• Wildcard *.subdomains</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => handleToggle(item.id)}
                  />
                  <span className="slider"></span>
                </label>

                <button
                  onClick={() => handleRemove(item.id)}
                  className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                  title="Remove domain"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspect Hosts Rules Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-white font-mono">Live Hosts Rules</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              FocusGuard appends these local entries between protected markers in <code className="text-white font-mono">%SystemRoot%\System32\drivers\etc\hosts</code>:
            </p>
            <div className="p-3 rounded-lg bg-black border border-white/15 max-h-60 overflow-y-auto font-mono text-xs text-zinc-300 space-y-1">
              <div className="text-zinc-600"># BEGIN FOCUSGUARD BLOCK</div>
              {websites
                .filter((w) => w.enabled)
                .map((w) => (
                  <React.Fragment key={w.id}>
                    <div>127.0.0.1 {w.domain}</div>
                    <div>::1 {w.domain}</div>
                    {w.includeSubdomains && (
                      <>
                        <div>127.0.0.1 www.{w.domain}</div>
                        <div>::1 www.{w.domain}</div>
                      </>
                    )}
                  </React.Fragment>
                ))}
              <div className="text-zinc-600"># END FOCUSGUARD BLOCK</div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-white">Import Domain List</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Paste domains separated by new lines or commas.</p>
            </div>
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="tiktok.com&#10;reddit.com&#10;x.com"
              className="input-field font-mono text-xs"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowImportModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button onClick={handleImportSubmit} className="btn-primary text-xs">
                Import Domains
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
