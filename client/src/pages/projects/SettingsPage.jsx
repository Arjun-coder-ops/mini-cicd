import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  
  useEffect(() => {
    api.get(`/projects/${projectId}`).then(res => setProject(res.data.project)).catch(console.error);
  }, [projectId]);

  const handleDelete = async () => {
    if (!window.confirm('Are you absolutely sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  if (!project) return null;

  return (
    <div>
      <h2>Settings</h2>
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Danger Zone</h3>
        <p style={{ color: 'var(--text2)', marginBottom: 15, marginTop: 5 }}>Once you delete a project, there is no going back. Please be certain.</p>
        <button onClick={handleDelete} className="btn btn-danger">Delete Project</button>
      </div>
    </div>
  );
}