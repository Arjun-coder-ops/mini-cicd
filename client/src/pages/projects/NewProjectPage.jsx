import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { FolderGit2 } from 'lucide-react';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [repository, setRepository] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/projects', { name, repository, defaultBranch });
      toast.success('Project created!');
      navigate(`/projects/${res.data.project._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FolderGit2 size={20} /> Create New Project
      </h2>
      <div className="card" style={{ marginTop: 20, maxWidth: 500 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label className="label">Project Name</label>
            <input className="input" placeholder="e.g. My Website" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">GitHub Repository</label>
            <input className="input" placeholder="e.g. facebook/react" value={repository} onChange={e => setRepository(e.target.value)} required />
          </div>
          <div>
            <label className="label">Default Branch</label>
            <input className="input" placeholder="main" value={defaultBranch} onChange={e => setDefaultBranch(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}
