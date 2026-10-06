import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Folder, Package, Settings, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/projects'),
      api.get('/metrics').catch(() => ({ data: '' })) // if metrics fail, ignore
    ]).then(([projRes, metricsRes]) => {
      setProjects(projRes.data.projects.slice(0, 5)); // show top 5
      
      // extremely basic parsing of prometheus metrics
      const lines = typeof metricsRes.data === 'string' ? metricsRes.data.split('\\n') : [];
      const m = {};
      lines.forEach(l => {
        if (!l.startsWith('#') && l.includes(' ')) {
          const [key, val] = l.split(' ');
          m[key] = parseInt(val, 10);
        }
      });
      setMetrics(m);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Welcome back, {user?.name}</h1>
        <p style={{ color: 'var(--text2)' }}>Here is what's happening across your platform.</p>
      </div>

      {/* Global metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 30 }}>
        <div className="card">
          <div className="label">Total Builds</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{metrics.builds_total || 0}</div>
        </div>
        <div className="card">
          <div className="label">Total Success</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{metrics.builds_success_total || 0}</div>
        </div>
        <div className="card">
          <div className="label">Total Deployments</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{metrics.deployment_total || 0}</div>
        </div>
        <div className="card">
          <div className="label">Webhooks Received</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--purple)', fontFamily: 'var(--mono)' }}>{metrics.webhook_total || 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ fontSize: 16 }}>Your Recent Projects</h3>
        <Link to="/projects" className="btn btn-ghost" style={{ fontSize: 12 }}>View all</Link>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {projects.length === 0 ? (
          <div className="card flex-center" style={{ padding: 40, flexDirection: 'column', gap: 10 }}>
            <Folder size={32} color="var(--text3)" />
            <p style={{ color: 'var(--text2)' }}>You don't have any projects yet.</p>
            <button onClick={() => navigate('/projects/new')} className="btn btn-primary" style={{ marginTop: 10 }}>Create Project</button>
          </div>
        ) : (
          projects.map(p => (
            <Link key={p._id} to={`/projects/${p._id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', transition: 'all 0.2s' }}>
              <div>
                <h4 style={{ color: 'var(--text)', margin: 0, fontSize: 15 }}>{p.name}</h4>
                <p style={{ color: 'var(--text2)', margin: 0, fontSize: 13, marginTop: 4 }}>{p.repository}</p>
              </div>
              <ChevronRight color="var(--text3)" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
