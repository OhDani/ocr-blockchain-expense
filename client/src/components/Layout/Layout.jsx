/**
 * Layout.jsx — Bố cục chính: Sidebar + Main content (responsive)
 */

import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Menu, X } from 'lucide-react';
import Sidebar from '../Sidebar/Sidebar.jsx';
import './Layout.css';

export default function Layout() {
    const { user, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="loading-center" style={{ height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="layout">
            {/* Mobile hamburger */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Overlay for mobile */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="layout__main">
                <Outlet />
            </main>
        </div>
    );
}
