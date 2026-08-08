/**
 * Sidebar.jsx — Thanh menu bên trái (responsive)
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
    LayoutDashboard, Plane, FileText, Camera,
    Building2, ClipboardCheck, BarChart3, LogOut, Settings, Users,
} from 'lucide-react';
import NotificationBell from '../NotificationBell/NotificationBell.jsx';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Admin = kế toán → chỉ menu quản trị, không đi công tác
    // Employee & Manager → menu nhân viên
    const menuItems = user?.role === 'ADMIN'
        ? [
            { to: '/', icon: Building2, label: 'Bảng quản trị' },
            { to: '/admin/expenses', icon: ClipboardCheck, label: 'Duyệt chi phí' },
            { to: '/admin/users', icon: Users, label: 'Danh sách nhân viên' },
            { to: '/admin/departments', icon: BarChart3, label: 'Phòng ban' },
            { divider: true },
            { to: '/settings', icon: Settings, label: 'Cài đặt' },
        ]
        : [
            { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
            { to: '/trips', icon: Plane, label: 'Chuyến công tác' },
            { to: '/expenses', icon: FileText, label: 'Chi phí' },
            { to: '/upload', icon: Camera, label: 'Upload hóa đơn' },
            { to: '/settings', icon: Settings, label: 'Cài đặt' },
        ];

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            {/* Logo */}
            <div className="sidebar__logo">
                <img src="/assets/logo.png" alt="FlexiTrip" className="sidebar__logo-img" />
                <span className="sidebar__logo-text">FlexiTrip</span>
            </div>

            {/* Navigation */}
            <nav className="sidebar__nav">
                {menuItems.map((item, i) =>
                    item.divider ? (
                        <div key={i} className="sidebar__divider" />
                    ) : (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/' || item.to === '/admin'}
                            className={({ isActive }) =>
                                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                            }
                            onClick={onClose}
                        >
                            <item.icon size={18} className="sidebar__link-icon-svg" />
                            <span>{item.label}</span>
                        </NavLink>
                    )
                )}
            </nav>

            {/* User info + Logout */}
            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__avatar">
                        {user?.avatarUrl ? (
                            <img src={`http://localhost:3000${user.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                            user?.name?.charAt(0) || '?'
                        )}
                    </div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name">{user?.name}</div>
                        <div className="sidebar__user-role">
                            {user?.role === 'ADMIN' ? 'Quản trị viên' :
                                user?.role === 'MANAGER' ? 'Trưởng phòng' : 'Nhân viên'}
                        </div>
                    </div>
                </div>
                <NotificationBell />
                <button className="sidebar__logout" onClick={handleLogout} title="Đăng xuất">
                    <LogOut size={16} />
                </button>
            </div>
        </aside>
    );
}

