import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';

export default function AuditLogPage() {
  const { projectId } = useParams();
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    // Ideally we'd have a route for this:
    api.get(`/projects/${projectId}/audit`).then(res => setLogs(res.data.logs || [])).catch(console.error);
  }, [projectId]);

  return (
    <div>
      <h2>Audit Log</h2>
      <div className="card" style={{ marginTop: 20, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Action</th>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>User</th>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 15px' }}>{l.action}</td>
                <td style={{ padding: '12px 15px' }}>{l.userId}</td>
                <td style={{ padding: '12px 15px' }}>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}