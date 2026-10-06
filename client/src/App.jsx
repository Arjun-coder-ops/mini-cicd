import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import Layout from './components/ui/Layout';
import DashboardPage from './pages/DashboardPage';
import ProjectOverview from './pages/projects/ProjectOverview';
import ProjectsPage from './pages/projects/ProjectsPage';
import DeploymentsPage from './pages/projects/DeploymentsPage';
import MembersPage from './pages/projects/MembersPage';
import ApiKeysPage from './pages/projects/ApiKeysPage';
import SecretsPage from './pages/projects/SecretsPage';
import SettingsPage from './pages/projects/SettingsPage';
import AuditLogPage from './pages/projects/AuditLogPage';

import BuildsPage from './pages/BuildsPage';
import BuildDetailPage from './pages/BuildDetailPage';
import TriggerPage from './pages/TriggerPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  const { loading } = useAuth();
  if (loading) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectOverview />} />
          <Route path="projects/:projectId/builds" element={<BuildsPage />} />
          <Route path="projects/:projectId/builds/:id" element={<BuildDetailPage />} />
          <Route path="projects/:projectId/trigger" element={<TriggerPage />} />
          <Route path="projects/:projectId/deployments" element={<DeploymentsPage />} />
          <Route path="projects/:projectId/members" element={<MembersPage />} />
          <Route path="projects/:projectId/api-keys" element={<ApiKeysPage />} />
          <Route path="projects/:projectId/secrets" element={<SecretsPage />} />
          <Route path="projects/:projectId/settings" element={<SettingsPage />} />
          <Route path="projects/:projectId/audit" element={<AuditLogPage />} />

        </Route>
      </Routes>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#13161e', color: '#e8eaf0', border: '1px solid #252836', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' },
      }} />
    </BrowserRouter>
  );
}
