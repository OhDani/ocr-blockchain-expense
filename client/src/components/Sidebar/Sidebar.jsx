/**
 * Sidebar.jsx — Thanh menu bên trái (responsive)
 * Phân chia mục menu rõ ràng, màu thương hiệu FlexiTrip chuyên nghiệp và giữ nguyên cấu trúc gọn gàng.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getAssetUrl } from '../../api/client.js';
import {
    LayoutDashboard, Plane, FileText, Camera,
    Building2, ClipboardCheck, BarChart3, LogOut, Settings, Users,
    PieChart, Bell, Activity, Shield, UserCheck,
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

    let menuSections = [];
    if (user?.role === 'ADMIN') {
        menuSections = [
            {
                title: 'Quản trị hệ thống',
                items: [
                    { to: '/', icon: Building2, label: 'Bảng quản trị' },
                    { to: '/admin/expenses', icon: ClipboardCheck, label: 'Duyệt chi phí' },
                    { to: '/admin/users', icon: Users, label: 'Danh sách nhân viên' },
                    { to: '/admin/departments', icon: BarChart3, label: 'Phòng ban' },
                    { to: '/reports', icon: PieChart, label: 'Báo cáo' },
                ]
            },
            {
                title: 'Hệ thống & Cá nhân',
                items: [
                    { to: '/notifications', icon: Bell, label: 'Thông báo' },
                    { to: '/admin/settings', icon: Shield, label: 'Cấu hình hệ thống' },
                    { to: '/settings', icon: UserCheck, label: 'Hồ sơ cá nhân' },
                ]
            }
        ];
    } else if (user?.role === 'MANAGER') {
        menuSections = [
            {
                title: 'Công tác & Chi phí',
                items: [
                    { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
                    { to: '/trips', icon: Plane, label: 'Chuyến công tác' },
                    { to: '/expenses', icon: FileText, label: 'Chi phí' },
                    { to: '/upload', icon: Camera, label: 'Upload hóa đơn' },
                ]
            },
            {
                title: 'Quản lý phòng ban',
                items: [
                    { to: '/admin/users', icon: Users, label: 'Danh sách nhân viên' },
                    { to: '/reports', icon: PieChart, label: 'Báo cáo' },
                ]
            },
            {
                title: 'Cá nhân',
                items: [
                    { to: '/activity', icon: Activity, label: 'Lịch sử' },
                    { to: '/notifications', icon: Bell, label: 'Thông báo' },
                    { to: '/settings', icon: Settings, label: 'Cài đặt' },
                ]
            }
        ];
    } else {
        // EMPLOYEE
        menuSections = [
            {
                title: 'Công tác & Chi phí',
                items: [
                    { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
                    { to: '/trips', icon: Plane, label: 'Chuyến công tác' },
                    { to: '/expenses', icon: FileText, label: 'Chi phí' },
                    { to: '/upload', icon: Camera, label: 'Upload hóa đơn' },
                ]
            },
            {
                title: 'Cá nhân',
                items: [
                    { to: '/activity', icon: Activity, label: 'Lịch sử' },
                    { to: '/notifications', icon: Bell, label: 'Thông báo' },
                    { to: '/settings', icon: Settings, label: 'Cài đặt' },
                ]
            }
        ];
    }

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            {/* Logo FlexiTrip: Flexi (đen thanh lịch) + Trip (xanh teal thương hiệu) */}
            <div className="sidebar__logo">
                <img src="/assets/logo.png" alt="FlexiTrip" className="sidebar__logo-img" />
                <span className="sidebar__logo-text">
                    <span className="sidebar__logo-flexi">Flexi</span>
                    <span className="sidebar__logo-trip">Trip</span>
                </span>
            </div>

            {/* Navigation phân mục */}
            <nav className="sidebar__nav">
                {menuSections.map((section, sIdx) => (
                    <div key={sIdx} className="sidebar__section">
                        <div className="sidebar__section-title">
                            {section.title}
                        </div>
                        <div className="sidebar__section-items">
                            {section.items.map((item) => (
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
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User info + Logout */}
            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__avatar">
                        {user?.avatarUrl ? (
                            <img src={getAssetUrl(user.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
