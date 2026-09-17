import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import BuildRow from '../components/ui/BuildRow';

const STATUSES = ['', 'success', 'failed', 'running', 'queued', 'cancelled', 'timed_out'];

export default function BuildsPage() {
  const [builds, setBuilds] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', branch: '', repo: '' });
  const [draft, setDraft] = useState({ status: '', branch: '', repo: '' });

  const fetchBuilds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (filters.status) params.set('status', filters.status);
      if (filters.branch) params.set('branch', filters.branch);
      if (filters.repo)   params.set('repo',   filters.repo);
      const { data } = await api.get(`/builds?${params}`);
      setBuilds(data.builds);
      setTotal(data.total);
      setPages(data.pages);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchBuilds(); }, [fetchBuilds]);

  // Auto-refresh if any running builds
  useEffect(() => {
    const hasRunning = builds.some(b => ['running', 'queued'].includes(b.status));
    if (!hasRunning) return;
    const t = setInterval(fetchBuilds, 5000);
    return () => clearInterval(t);
  }, [builds, fetchBuilds]);

  const applyFilters = (e) => {
    e.preventDefault();
    setFilters(draft);
    setPage(1);
  };

  const clearFilters = () => {
    setDraft({ status: '', branch: '', repo: '' });
    setFilters({ status: '', branch: '', repo: '' });
    setPage(1);
  };

  const hasFilters = filters.status || filters.branch || filters.repo;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--mono)' }}>All Builds</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
          {total} total builds
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={applyFilters}
        style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">Status</label>
          <select className="input" value={draft.status}
            onChange={e => setDraft(p => ({ ...p, status: e.target.value }))}
            style={{ width: 140 }}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Branch</label>
          <input className="input" placeholder="main" value={draft.branch}
            onChange={e => setDraft(p => ({ ...p, branch: e.target.value }))}
            style={{ width: 140 }} />
        </div>
        <div>
          <label className="label">Repository</label>
          <input className="input" placeholder="owner/repo" value={draft.repo}
            onChange={e => setDraft(p => ({ ...p, repo: e.target.value }))}
            style={{ width: 180 }} />
        </div>
        <button type="submit" className="btn btn-ghost">Filter</button>
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={clearFilters}
            style={{ color: 'var(--red)' }}>
            × Clear
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={fetchBuilds}
          style={{ marginLeft: 'auto' }}>
          ↻ Refresh
        </button>
      </form>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 140px 100px 90px',
          gap: 14, padding: '9px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)',
        }}>
          {['Build', 'Repository', 'Status', 'Duration', 'When'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>

        {loading && builds.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            loading...
          </div>
        ) : builds.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            no builds found
          </div>
        ) : (
          builds.map(b => <BuildRow key={b._id} build={b} />)
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost" disabled={page <= 1}
            onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px' }}>
            ← Prev
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 11px', minWidth: 34 }}>
                {p}
              </button>
            );
          })}
          <button className="btn btn-ghost" disabled={page >= pages}
            onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
