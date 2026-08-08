/**
 * NotificationBell.jsx — Bell icon with notification dropdown
 */

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, XCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { notificationAPI } from '../../api/client.js';
import './NotificationBell.css';

const ICON_MAP = {
    expense_reimbursed: { icon: CheckCircle, color: '#10b981' },
    expense_approved: { icon: CheckCircle, color: '#3b82f6' },
    expense_rejected: { icon: XCircle, color: '#ef4444' },
    expense_pending: { icon: Clock, color: '#f59e0b' },
    appeal_received: { icon: AlertTriangle, color: '#f59e0b' },
};

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ref = useRef(null);

    const fetchNotifications = async () => {
        try {
            const res = await notificationAPI.list();
            setNotifications(res.data);
            setUnreadCount(res.unreadCount);
        } catch (err) {
            console.error('Notification fetch error:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleReadAll = async () => {
        try {
            await notificationAPI.readAll();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const timeAgo = (date) => {
        const diff = (Date.now() - new Date(date).getTime()) / 1000;
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
        return `${Math.floor(diff / 86400)} ngày trước`;
    };

    return (
        <div className="notif-bell" ref={ref}>
            <button
                className="notif-bell__btn"
                onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
                title="Thông báo"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {open && (
                <div className="notif-dropdown">
                    <div className="notif-dropdown__header">
                        <h3>Thông báo</h3>
                        {unreadCount > 0 && (
                            <button className="notif-dropdown__read-all" onClick={handleReadAll}>
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    <div className="notif-dropdown__list">
                        {notifications.length === 0 ? (
                            <div className="notif-dropdown__empty">
                                <Bell size={32} strokeWidth={1} />
                                <p>Chưa có thông báo</p>
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const typeInfo = ICON_MAP[n.type] || ICON_MAP.expense_pending;
                                const Icon = typeInfo.icon;
                                return (
                                    <div
                                        key={n.id}
                                        className={`notif-item ${!n.isRead ? 'notif-item--unread' : ''}`}
                                        onClick={async () => {
                                            if (!n.isRead) {
                                                await notificationAPI.read(n.id);
                                                setNotifications((prev) =>
                                                    prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x)
                                                );
                                                setUnreadCount((c) => Math.max(0, c - 1));
                                            }
                                        }}
                                    >
                                        <div className="notif-item__icon" style={{ color: typeInfo.color }}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="notif-item__content">
                                            <div className="notif-item__title">{n.title}</div>
                                            <div className="notif-item__message">{n.message}</div>
                                            <div className="notif-item__time">{timeAgo(n.createdAt)}</div>
                                        </div>
                                        {!n.isRead && <div className="notif-item__dot" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
