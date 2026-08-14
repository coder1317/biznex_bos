import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui';
import Login from './pages/Login';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Discounts from './pages/Discounts';
import Complaints from './pages/Complaints';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import './index.css';

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Route-level role guard: redirects to the POS terminal when the signed-in
// role isn't allowed here (mirrors the server-side checks in the API).
const ROLE_LEVEL = { owner: 4, admin: 3, manager: 2, cashier: 1 };
function RequireRole({ role, children }) {
  const { user } = useAuth();
  const level = user ? (ROLE_LEVEL[user.role] ?? 0) : 0;
  if (level < (ROLE_LEVEL[role] ?? 0)) return <Navigate to="/pos" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/inventory" element={<RequireRole role="manager"><Inventory /></RequireRole>} />
                <Route path="/staff" element={<RequireRole role="admin"><Staff /></RequireRole>} />
                <Route path="/discounts" element={<RequireRole role="manager"><Discounts /></RequireRole>} />
                <Route path="/complaints" element={<RequireRole role="manager"><Complaints /></RequireRole>} />
                <Route path="/reports" element={<RequireRole role="manager"><Reports /></RequireRole>} />
                <Route path="/settings" element={<RequireRole role="admin"><Settings /></RequireRole>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
