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
} from 'lucide-react';
import { BlockedWebsite } from '../types';

interface WebsiteBlockerProps {
  websites: BlockedWebsite[];
  onAddWebsite: (domain: string, category: BlockedWebsite['category'], includeSubdomains: boolean) => void;
  onToggleWebsite: (id: string) => void;
  onRemoveWebsite: (id: string) => void;
}

export const WebsiteBlocker: React.FC<WebsiteBlockerProps> = ({
  websites,
  onAddWebsite,
  onToggleWebsite,
  onRemoveWebsite,
}) => {
  const [newDomain, setNewDomain] = useState('');
  const [newCategory, setNewCategory] = useState<BlockedWebsite['category']>('entertainment');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    onAddWebsite(newDomain, newCategory, includeSubdomains);
    setNewDomain('');
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
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Globe className="text-sky-400" size={22} />
            Website Blocker
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Blocks domains and subdomains via local Windows DNS loopback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="btn-secondary text-xs"
            title="Inspect generated hosts lines"
          >
            <Eye size={14} />
            Inspect Hosts Rules
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-xs"
            title="Import domains"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary text-xs"
            title="Export block list"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Add Domain Form Card */}
      <div className="glass-panel p-4">
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Enter domain (e.g. youtube.com or reddit.com)"
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
                <option value="gaming">Gaming</option>
                <option value="news">News & Media</option>
                <option value="adult">Adult</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="subdomains"
                checked={includeSubdomains}
                onChange={(e) => setIncludeSubdomains(e.target.checked)}
                className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-white/20 cursor-pointer"
              />
              <label htmlFor="subdomains" className="text-xs text-slate-300 cursor-pointer">
                Subdomains
              </label>
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="btn-primary w-full justify-center text-xs">
                <Plus size={14} />
                Add Domain
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'social', 'entertainment', 'gaming', 'news', 'custom'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${
                selectedCategoryFilter === cat
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Domains Table / List */}
      <div className="glass-panel overflow-hidden">
        {filteredWebsites.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Globe size={32} className="mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No websites found</p>
            <p className="text-xs text-slate-500">
              {websites.length === 0
                ? 'Add distracting websites to start blocking.'
                : 'No domains match your current filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/40 text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Domain</th>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Subdomains</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredWebsites.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">
                    {item.domain}
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {item.includeSubdomains ? (
                      <span className="text-emerald-400 font-medium">Included (*.{item.domain})</span>
                    ) : (
                      <span className="text-slate-500">Exact only</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => onToggleWebsite(item.id)}
                      />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onRemoveWebsite(item.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                      title="Remove domain"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-lg w-full p-6 space-y-4 border border-sky-500/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Upload size={16} className="text-sky-400" />
                Import Domains
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste a list of domains below, separated by newlines or commas:
            </p>
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="youtube.com&#10;reddit.com&#10;instagram.com"
              className="input-field font-mono text-xs w-full"
            />
            <div className="flex items-center justify-end gap-2">
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

      {/* Preview Generated Hosts Entries Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-xl w-full p-6 space-y-4 border border-sky-500/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileCode size={16} className="text-sky-400" />
                Generated Hosts File Rules Preview
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              When a focus session starts, FocusGuard atomically inserts these entries into{' '}
              <code className="text-sky-300">C:\Windows\System32\drivers\etc\hosts</code>, rerouting
              both IPv4 and IPv6 traffic to loopback (127.0.0.1 and ::1).
            </p>
            <div className="p-3 rounded-lg bg-slate-950 border border-white/10 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto space-y-0.5">
              <div className="text-slate-500"># BEGIN FOCUSGUARD BLOCK</div>
              <div className="text-slate-500"># Automatically managed by FocusGuard</div>
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
                        <div>127.0.0.1 m.{w.domain}</div>
                      </>
                    )}
                  </React.Fragment>
                ))}
              <div className="text-slate-500"># END FOCUSGUARD BLOCK</div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowPreviewModal(false)} className="btn-secondary text-xs">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
