import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function SecretsPage() {
  const { projectId } = useParams();
  const [secrets, setSecrets] = useState([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    fetchSecrets();
  }, [projectId]);

  const fetchSecrets = () => {
    api.get(`/projects/${projectId}/secrets`).then(res => setSecrets(res.data.secrets)).catch(console.error);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/secrets`, { name, value });
      toast.success('Secret created');
      setName('');
      setValue('');
      fetchSecrets();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/projects/${projectId}/secrets/${id}`);
      toast.success('Secret deleted');
      fetchSecrets();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <h2>Secrets</h2>
      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Name (e.g. DATABASE_URL)</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Value</label>
            <input type="password" className="input" value={value} onChange={e => setValue(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary">Add Secret</button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Name</th>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Environment</th>
              <th style={{ padding: '10px 15px', textAlign: 'right', color: 'var(--text3)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {secrets.map(s => (
              <tr key={s._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 15px', fontFamily: 'var(--mono)' }}>{s.name}</td>
                <td style={{ padding: '12px 15px' }}>{s.environment}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                  <button onClick={() => handleDelete(s._id)} className="btn btn-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}