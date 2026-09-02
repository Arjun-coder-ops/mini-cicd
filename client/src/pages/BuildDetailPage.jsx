import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { STATUS_ICON, fmtDuration, fmtTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const STEP_ORDER = ['clone', 'install', 'build', 'test', 'deploy'];

const StepBadge = ({ step }) => {
  const s = step?.status || 'pending';
  const colors = {
    success:  { bg: 'var(--green-dim)', color: 'var(--green)',  border: 'rgba(61,214,140,.2)' },
    failed:   { bg: 'var(--red-dim)',   color: 'var(--red)',    border: 'rgba(244,100,95,.2)'  },
    running:  { bg: 'var(--blue-dim)',  color: 'var(--blue)',   border: 'rgba(91,156,246,.2)'  },
    pending:  { bg: 'var(--bg3)',       color: 'var(--text3)',  border: 'var(--border)'        },
    cancelled:{ bg: 'var(--bg3)',       color: 'var(--text3)',  border: 'var(--border)'        },
  };
  const c = colors[s] || colors.pending;

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minWidth: 90,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {s === 'running' ? (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
        ) : (
          <span style={{ fontSize: 13, color: c.color }}>{STATUS_ICON[s]}</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: c.color, fontFamily: 'var(--mono)' }}>
          {step?.name}
        </span>
      </div>
      {step?.duration && (
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {fmtDuration(step.duration)}
        </span>
      )}
    </div>
  );
};

export default function BuildDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [build, setBuild] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef(null);
  const esRef  = useRef(null);

  // Fetch build data
  const fetchBuild = useCallback(async () => {
    try {
      const { data } = await api.get(`/builds/${id}`);
      setBuild(data.build);
      return data.build;
    } catch {
      toast.error('Build not found');
      navigate('/builds');
    } finally { setLoading(false); }
  }, [id]);

  // Connect to SSE log stream
  const connectStream = useCallback((buildId) => {
    if (esRef.current) esRef.current.close();
    setStreaming(true);
    setLogs([]);

    const token = import.meta.env.VITE_API_AUTH_TOKEN;
    const es = new EventSource(`/api/builds/${buildId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        setLogs(prev => [...prev, line]);
      } catch (_) {}
    };

    es.addEventListener('step', (e) => {
      try {
        const { name, status, duration } = JSON.parse(e.data);
        setBuild(prev => {
          if (!prev) return prev;
          const steps = prev.steps.map(s =>
            s.name === name ? { ...s, status, duration } : s
          );
          return { ...prev, steps };
        });
      } catch (_) {}
    });

    es.addEventListener('done', (e) => {
      try {
        const { status } = JSON.parse(e.data);
        setBuild(prev => prev ? { ...prev, status } : prev);
        setStreaming(false);
        es.close();
        // Refresh build for final timing
        fetchBuild();
      } catch (_) {}
    });

    es.onerror = () => { setStreaming(false); es.close(); };
  }, [fetchBuild]);

  useEffect(() => {
    fetchBuild().then(b => {
      if (!b) return;
      if (['queued', 'running'].includes(b.status)) {
        connectStream(b._id);
      } else {
        // Load static logs
        api.get(`/builds/${b._id}/logs`).then(({ data }) => {
          setLogs(data.logs ? data.logs.split('\n').filter(Boolean) : []);
        });
      }
    });
    return () => { if (esRef.current) esRef.current.close(); };
  }, [id]);

  // Auto-scroll log pane
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCancel = async () => {
    try {
      await api.post(`/builds/${id}/cancel`);
      toast.success('Build cancelled');
      if (esRef.current) esRef.current.close();
      fetchBuild();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleRetry = async () => {
    try {
      const { data } = await api.post(`/builds/${id}/retry`);
      toast.success(`Retry started — Build #${data.build.number}`);
      navigate(`/builds/${data.build._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to retry');
    }
  };

  const getLineColor = (line) => {
    if (line.includes('✓') || line.includes('passed') || line.includes('success')) return 'var(--green)';
    if (line.includes('✗') || line.includes('error') || line.includes('Error') || line.includes('FAIL')) return 'var(--red)';
    if (line.includes('WARNING') || line.includes('warn')) return 'var(--amber)';
    if (line.includes('──') || line.includes('═')) return 'var(--blue)';
    if (line.startsWith('[') && line.includes(']') && line.includes('$')) return 'var(--cyan)';
    if (line.includes('[simulated]')) return 'var(--text3)';
    return 'var(--text2)';
  };

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Loading...</div>
  );
  if (!build) return null;

  const statusColors = {
    success: 'var(--green)', failed: 'var(--red)',
    running: 'var(--blue)', queued: 'var(--text2)', cancelled: 'var(--text3)', timed_out: 'var(--amber)',
  };

  // Merge pipeline step order with actual build steps
  const mergedSteps = STEP_ORDER.map(name => {
    return build.steps?.find(s => s.name === name) || { name, status: 'pending' };
  });

  return (
    <div className="fade-in">
      {/* Back */}
      <button className="btn btn-ghost" onClick={() => navigate('/builds')}
        style={{ marginBottom: 18, padding: '6px 12px', fontSize: 12 }}>
        ← All builds
      </button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                Build #{build.number}
              </span>
              <span className={`status status-${build.status}`}>
                {STATUS_ICON[build.status]} {build.status}
              </span>
              {streaming && (
                <span style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--mono)', animation: 'pulse 1s infinite' }}>
                  ● live
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                📁 <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{build.repo}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                🌿 <span style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{build.branch}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                🔖 <span style={{ fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{build.commitShort}</span>
                {build.commitMsg && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{build.commitMsg}</span>}
              </span>
              {build.author && (
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                  👤 {build.author}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                Started: {fmtTime(build.startedAt)}
              </span>
              {build.finishedAt && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Finished: {fmtTime(build.finishedAt)}
                </span>
              )}
              {build.duration && (
                <span style={{ fontSize: 11, color: statusColors[build.status] || 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  ⏱ {fmtDuration(build.duration)}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                Trigger: {build.trigger}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {['queued', 'running'].includes(build.status) && (
              <button className="btn btn-danger" onClick={handleCancel}>✕ Cancel</button>
            )}
            {['success', 'failed', 'cancelled'].includes(build.status) && (
              <button className="btn btn-success" onClick={handleRetry}>↺ Retry</button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          Pipeline steps
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {mergedSteps.map((step, i) => (
            <div key={step.name} style={{ display: 'flex', alignItems: 'center' }}>
              <StepBadge step={step} />
              {i < mergedSteps.length - 1 && (
                <span style={{ color: 'var(--text3)', margin: '0 3px', fontSize: 14 }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Log viewer */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)' }}>
              Build logs
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {logs.length} lines
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
              <input type="checkbox" checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                style={{ accentColor: 'var(--blue)', width: 12, height: 12 }} />
              Auto-scroll
            </label>
            <button className="btn btn-ghost"
              onClick={() => { setAutoScroll(true); if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }}
              style={{ padding: '3px 8px', fontSize: 11 }}>
              ↓ Bottom
            </button>
            <button className="btn btn-ghost"
              onClick={() => { const t = logs.join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t])); a.download = `build-${build.number}.log`; a.click(); }}
              style={{ padding: '3px 8px', fontSize: 11 }}>
              ↓ Download
            </button>
          </div>
        </div>

        <div ref={logRef}
          onScroll={e => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setAutoScroll(atBottom);
          }}
          style={{
            height: 480, overflowY: 'auto', padding: '14px 18px',
            background: '#090b10', fontFamily: 'var(--mono)', fontSize: 12,
            lineHeight: 1.75,
          }}>
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text3)' }}>
              {streaming ? 'Waiting for output...' : 'No logs available'}
            </span>
          ) : (
            logs.map((line, i) => (
              <div key={i} style={{ color: getLineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <span style={{ color: 'var(--text3)', userSelect: 'none', marginRight: 12, display: 'inline-block', minWidth: 36, textAlign: 'right' }}>
                  {i + 1}
                </span>
                {line}
              </div>
            ))
          )}
          {streaming && (
            <div style={{ color: 'var(--blue)', marginTop: 4 }}>
              <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>▌</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
