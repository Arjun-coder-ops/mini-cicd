import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/ui/Layout';
import DashboardPage from './pages/DashboardPage';
import BuildsPage from './pages/BuildsPage';
import BuildDetailPage from './pages/BuildDetailPage';
import TriggerPage from './pages/TriggerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="builds"    element={<BuildsPage />} />
          <Route path="builds/:id" element={<BuildDetailPage />} />
          <Route path="trigger"   element={<TriggerPage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#13161e', color: '#e8eaf0', border: '1px solid #252836', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif' },
      }} />
    </BrowserRouter>
  );
}
