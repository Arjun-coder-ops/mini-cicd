import React from 'react';
import { Outlet, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Settings, Users, Key, Shield, Folder, Activity, LogOut, FileText, Play } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const GLOBAL_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/projects',  icon: Folder,          label: 'Projects' },
];

const getProjectNav = (projectId) => [
  { to: `/projects/${projectId}`,              icon: LayoutDashboard, label: 'Overview', end: true },
  { to: `/projects/${projectId}/builds`,       icon: Package,         label: 'Builds' },
  { to: `/projects/${projectId}/trigger`,      icon: Play,            label: 'Trigger Build' },
  { to: `/projects/${projectId}/deployments`,  icon: Activity,        label: 'Deployments' },
  { to: `/projects/${projectId}/members`,      icon: Users,           label: 'Members' },
  { to: `/projects/${projectId}/api-keys`,     icon: Key,             label: 'API Keys' },
  { to: `/projects/${projectId}/secrets`,      icon: Shield,          label: 'Secrets' },
  { to: `/projects/${projectId}/audit`,        icon: FileText,        label: 'Audit Log' },
  { to: `/projects/${projectId}/settings`,     icon: Settings,        label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Try to extract projectId from URL (e.g. /projects/:projectId/...)
  const match = location.pathname.match(/^\/projects\/([a-f0-9]{24})/);
  const projectId = match ? match[1] : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = projectId ? getProjectNav(projectId) : GLOBAL_NAV;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={20} color="var(--blue)" />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Mini CI/CD
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '12px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {projectId ? 'Project Menu' : 'Global Menu'}
        </div>
        
        <nav style={{ flex: 1, padding: '0 10px' }}>
          {projectId && (
            <NavLink to="/projects" className="btn-ghost" style={{ display: 'block', marginBottom: 15, padding: '6px 10px', borderRadius: 6, fontSize: 12, textAlign: 'center' }}>
              &larr; Back to Projects
            </NavLink>
          )}
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 7, marginBottom: 4,
              fontSize: 13, fontWeight: 500,
              background: isActive ? 'var(--bg4)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text2)',
              borderLeft: `2px solid ${isActive ? 'var(--blue)' : 'transparent'}`,
              transition: 'all .1s',
            })}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer User */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--text2)' }} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, padding: '30px 40px', minHeight: '100vh', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
