import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ArrowRight, GitBranch, Webhook, FolderGit2, Package, Hammer, FlaskConical, Rocket } from 'lucide-react';
import api from '../utils/api';
import BuildRow from '../components/ui/BuildRow';
import { fmtDuration } from '../utils/helpers';

const STAT = ({ label, value, sub, color }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--mono)' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>}
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/builds/stats');
      setStats(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000); // auto-refresh
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>Loading...</div>
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--mono)' }}>Pipeline Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Auto-refreshes every 8s</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/trigger')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Play size={14} aria-hidden="true" /> Trigger build
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <STAT label="Total builds"   value={stats?.total || 0}        color="var(--text)" />
        <STAT label="Success"        value={stats?.success || 0}       color="var(--green)" />
        <STAT label="Failed"         value={stats?.failed || 0}        color="var(--red)" />
        <STAT label="Success rate"   value={`${stats?.successRate || 0}%`}   color={stats?.successRate >= 80 ? 'var(--green)' : 'var(--amber)'} />
        <STAT label="Avg duration"   value={`${stats?.avgDuration || 0}s`}  color="var(--blue)" />
      </div>

      {/* Running builds */}
      {stats?.running > 0 && (
        <div style={{ background: 'var(--blue-dim)', border: '1px solid rgba(91,156,246,.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 500 }}>
            {stats.running} build{stats.running > 1 ? 's' : ''} currently running
          </span>
          <button className="btn btn-ghost" onClick={() => navigate('/builds?status=running')}
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            View <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Recent builds */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Recent builds</span>
          <button className="btn btn-ghost" onClick={() => navigate('/builds')}
            style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            All builds <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 100px 90px', gap: 14, padding: '8px 18px', borderBottom: '1px solid var(--border)' }}>
          {['Build', 'Repository', 'Status', 'Duration', 'When'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>

        {!stats?.recent?.length ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            no builds yet — trigger one or push to GitHub
          </div>
        ) : (
          stats.recent.map(b => <BuildRow key={b._id} build={b} />)
        )}
      </div>

      {/* Pipeline diagram */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 14 }}>Pipeline flow</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontFamily: 'var(--mono)', fontSize: 11 }}>
          {[
            { label: 'git push', icon: GitBranch, color: 'var(--blue)' },
            { label: 'webhook', icon: Webhook, color: 'var(--purple)' },
            { label: 'clone', icon: FolderGit2, color: 'var(--cyan)' },
            { label: 'install', icon: Package, color: 'var(--amber)' },
            { label: 'build', icon: Hammer, color: 'var(--amber)' },
            { label: 'test', icon: FlaskConical, color: 'var(--green)' },
            { label: 'deploy', icon: Rocket, color: 'var(--green)' },
          ].map((step, i, arr) => {
            const Icon = step.icon;
            return (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, border: `1px solid var(--border2)` }}>
                  <Icon size={16} style={{ color: step.color }} aria-hidden="true" />
                  <span style={{ color: step.color, fontSize: 10 }}>{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight size={13} style={{ color: 'var(--text3)', margin: '0 6px', flexShrink: 0 }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
