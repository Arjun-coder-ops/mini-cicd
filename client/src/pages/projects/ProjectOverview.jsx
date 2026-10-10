import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import { Activity, Clock, AlertCircle, CheckCircle2, Play } from 'lucide-react';

export default function ProjectOverview() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/builds?projectId=${projectId}&limit=5`)
    ]).then(([projRes, buildRes]) => {
      setProject(projRes.data.project);
      setBuilds(buildRes.data?.builds || []);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div>Loading project...</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h2>{project.name}</h2>
          <p style={{ color: 'var(--text2)', marginTop: 4 }}>{project.repository} ({project.defaultBranch})</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to={`/projects/${projectId}/trigger`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Play size={15} /> Trigger Build
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 30 }}>
        <div className="card">
          <div className="label">Total Builds</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{project.stats?.totalBuilds || 0}</div>
        </div>
        <div className="card">
          <div className="label">Success Rate</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--green)' }}>
             {project.stats?.totalBuilds ? Math.round((project.stats.successfulBuilds / project.stats.totalBuilds) * 100) : 0}%
          </div>
        </div>
        <div className="card">
          <div className="label">Failed Builds</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--red)' }}>{project.stats?.failedBuilds || 0}</div>
        </div>
        <div className="card">
          <div className="label">Deployments</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--blue)' }}>{project.stats?.deployments || 0}</div>
        </div>
      </div>

      <h3>Recent Builds</h3>
      <div className="card" style={{ marginTop: 15, padding: 0, overflow: 'hidden' }}>
        {builds.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text2)' }}>No builds yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Build</th>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Commit</th>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Status</th>
                <th style={{ padding: '10px 15px', textAlign: 'right', color: 'var(--text3)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {builds.map(b => (
                <tr key={b._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 15px' }}>
                    <Link to={`/projects/${projectId}/builds/${b._id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>#{b.number}</Link>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{b.branch}</div>
                  </td>
                  <td style={{ padding: '12px 15px', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {b.commitShort}
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontFamily: 'var(--sans)' }}>{b.author}</div>
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <span className={`status status-${b.status}`}>{b.status}</span>
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right', color: 'var(--text2)' }}>
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
