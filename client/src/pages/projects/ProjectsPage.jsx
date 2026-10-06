import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Plus, Box, ExternalLink, Activity } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then(res => {
      setProjects(res.data.projects);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Projects</h2>
        <Link to="/projects/new" className="btn btn-primary"><Plus size={16}/> New Project</Link>
      </div>

      {loading ? (
        <div>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="card flex-center" style={{ padding: 40, flexDirection: 'column', gap: 10 }}>
          <Box size={40} color="var(--text3)" />
          <p style={{ color: 'var(--text2)' }}>You don't have any projects yet.</p>
          <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: 10 }}>Create your first project</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {projects.map(p => (
            <div key={p._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: 16 }}>
                  <Link to={`/projects/${p._id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>{p.name}</Link>
                </h3>
                <span className="status status-queued">{p.visibility}</span>
              </div>
              
              <div style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>
                <p><strong>Repository:</strong> {p.repository}</p>
                <p><strong>Branch:</strong> {p.defaultBranch}</p>
              </div>

              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border2)', paddingTop: 15, marginTop: 'auto' }}>
                <Link to={`/projects/${p._id}`} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Dashboard</Link>
                <Link to={`/projects/${p._id}/settings`} className="btn btn-ghost"><ExternalLink size={14}/></Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
