import { Outlet, NavLink } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', icon: '⚡', label: 'Dashboard' },
  { to: '/builds',    icon: '🔧', label: 'Builds'    },
  { to: '/trigger',   icon: '▶',  label: 'Trigger'   },
];

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 200, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            <span style={{ color: 'var(--green)' }}>▶</span> mini-cicd
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--mono)' }}>
            pipeline dashboard
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 7, marginBottom: 2,
              fontSize: 13, fontWeight: 500,
              background: isActive ? 'var(--bg4)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text2)',
              borderLeft: `2px solid ${isActive ? 'var(--blue)' : 'transparent'}`,
              transition: 'all .13s',
            })}>
              <span style={{ fontSize: 13 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          <div>GitHub → Webhook</div>
          <div>→ Build → Deploy</div>
        </div>
      </aside>

      <main style={{ marginLeft: 200, flex: 1, padding: '24px 30px', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
}
