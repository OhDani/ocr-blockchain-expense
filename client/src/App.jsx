/**
 * App.jsx — Router chính cho FlexiTrip
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Layout
import Layout from './components/Layout/Layout.jsx';

// Pages
import LoginPage from './pages/Login/LoginPage.jsx';
import DashboardPage from './pages/Dashboard/DashboardPage.jsx';
import TripsPage from './pages/Trips/TripsPage.jsx';
import ExpensesPage from './pages/Expenses/ExpensesPage.jsx';
import UploadPage from './pages/Upload/UploadPage.jsx';
import AdminDashboard from './pages/Admin/AdminDashboard.jsx';
import AdminExpenses from './pages/Admin/AdminExpenses.jsx';
import AdminDepartments from './pages/Admin/AdminDepartments.jsx';
import AdminUsers from './pages/Admin/AdminUsers.jsx';
import SettingsPage from './pages/Settings/SettingsPage.jsx';

/**
 * Guard: Chỉ Admin mới truy cập được
 */
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

/**
 * Guard: Redirect nếu đã đăng nhập
 */
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/**
 * Smart Dashboard: Admin → AdminDashboard, Employee/Manager → DashboardPage
 */
function SmartDashboard() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <AdminDashboard /> : <DashboardPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<GuestRoute><LoginPage /></GuestRoute>}
        />

        <Route element={<Layout />}>
          {/* "/" hiện dashboard phù hợp theo role */}
          <Route index element={<SmartDashboard />} />

          {/* Employee + Manager routes */}
          <Route path="trips" element={<TripsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Admin-only routes */}
          <Route path="admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="admin/departments" element={<AdminRoute><AdminDepartments /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
