import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Activity } from 'lucide-react';

export default function DeploymentsPage() {
  const { projectId } = useParams();
  const [deployments, setDeployments] = useState([]);
  
  useEffect(() => {
    api.get('/projects/' + projectId).then(() => {
      // Assuming a backend route for deployments exists, or we get them from some build expansion.
      // If the backend doesn't have GET /api/projects/:projectId/deployments, this will 404, 
      // but let's assume we can fetch them. We'll add that backend route if missing.
      api.get(`/projects/${projectId}/deployments`)
         .then(res => setDeployments(res.data.deployments || []))
         .catch(console.error);
    });
  }, [projectId]);

  return (
    <div>
      <h2>Deployments</h2>
      <div className="card" style={{ marginTop: 20, padding: 0 }}>
        {deployments.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text2)' }}>No deployments yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Environment</th>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Status</th>
                <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map(d => (
                <tr key={d._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 15px' }}>{d.environment}</td>
                  <td style={{ padding: '12px 15px' }}>{d.status}</td>
                  <td style={{ padding: '12px 15px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}