import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function MembersPage() {
  const { projectId } = useParams();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = () => {
    api.get(`/projects/${projectId}/members`).then(res => setMembers(res.data.members)).catch(console.error);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/members`, { email, role });
      toast.success('Member added');
      fetchMembers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleRemove = async (userId) => {
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      toast.success('Member removed');
      fetchMembers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <h2>Members</h2>
      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="VIEWER">Viewer</option>
              <option value="DEVELOPER">Developer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Add Member</button>
        </form>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>User</th>
              <th style={{ padding: '10px 15px', textAlign: 'left', color: 'var(--text3)' }}>Role</th>
              <th style={{ padding: '10px 15px', textAlign: 'right', color: 'var(--text3)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 15px' }}>{m.userId}</td>
                <td style={{ padding: '12px 15px' }}>{m.role}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                  <button onClick={() => handleRemove(m.userId)} className="btn btn-danger">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}