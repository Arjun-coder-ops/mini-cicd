import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ApiKeysPage() {
  const { projectId } = useParams();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState(null);

  useEffect(() => {
    fetchKeys();
  }, [projectId]);

  const fetchKeys = () => {
    api.get(`/projects/${projectId}/api-keys`).then(res => setKeys(res.data.apiKeys)).catch(console.error);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/projects/${projectId}/api-keys`, { name });
      setNewKey(res.data.apiKey);
      toast.success('API Key created');
      fetchKeys();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleRevoke = async (keyId) => {
    try {
      await api.delete(`/projects/${projectId}/api-keys/${keyId}`);
      toast.success('API Key revoked');
      fetchKeys();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <h2>API Keys</h2>
      
      {newKey && (
        <div style={{ padding: 15, background: 'var(--blue-dim)', border: '1px solid var(--blue)', borderRadius: 8, marginTop: 20 }}>
          <h4 style={{ color: 'var(--blue)' }}>API Key Created</h4>
          <p style={{ color: 'var(--text)' }}>This key will not be shown again. Please copy it now.</p>
          <code style={{ display: 'block', padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 4, marginTop: 10, color: 'var(--cyan)' }}>
            {newKey}
          </code>
          <button onClick={() => setNewKey(null)} className="btn btn-ghost" style={{ marginTop: 10 }}>Close</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Key Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary">Create Key</button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Name</th>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Prefix</th>
              <th style={{ padding: '10px 15px', textAlign: 'right', color: 'var(--text3)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k._id} style={{ borderBottom: '1px solid var(--border)', opacity: k.revokedAt ? 0.5 : 1 }}>
                <td style={{ padding: '12px 15px' }}>{k.name} {k.revokedAt && '(Revoked)'}</td>
                <td style={{ padding: '12px 15px', fontFamily: 'var(--mono)' }}>{k.keyPrefix}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                  {!k.revokedAt && <button onClick={() => handleRevoke(k._id)} className="btn btn-danger">Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}