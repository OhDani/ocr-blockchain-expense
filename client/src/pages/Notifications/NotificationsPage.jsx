/**
 * NotificationsPage.jsx — Trang thông báo đầy đủ (timeline)
 */

import { useState, useEffect } from 'react';
import { notificationAPI } from '../../api/client.js';
import { Bell, Check, CheckCheck, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';

const TYPE_MAP = {
    expense_approved: { icon: <Check size={16} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    expense_rejected: { icon: <AlertCircle size={16} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    expense_reimbursed: { icon: <DollarSign size={16} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    expense_submitted: { icon: <FileText size={16} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const res = await notificationAPI.list();
            setNotifications(res.data);
            setUnreadCount(res.unreadCount);
        } catch (err) {
            console.error('Lỗi tải thông báo:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotifications(); }, []);

    const handleReadAll = async () => {
        try {
            await notificationAPI.readAll();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const handleRead = async (id) => {
        try {
            await notificationAPI.read(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    // Group by date
    const grouped = {};
    notifications.forEach(n => {
        const dateKey = new Date(n.createdAt).toLocaleDateString('vi-VN');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(n);
    });

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1><Bell size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Thông báo</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-secondary" onClick={handleReadAll}>
                        <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Bell size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                        <div className="empty-state__text">Chưa có thông báo nào</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {Object.entries(grouped).map(([date, items]) => (
                        <div key={date}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 12, paddingLeft: 4 }}>{date}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {items.map(n => {
                                    const typeInfo = TYPE_MAP[n.type] || { icon: <Bell size={16} />, color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
                                    return (
                                        <div key={n.id}
                                            onClick={() => !n.isRead && handleRead(n.id)}
                                            style={{
                                                padding: '14px 18px',
                                                border: `1px solid ${n.isRead ? 'var(--color-border)' : typeInfo.color + '40'}`,
                                                borderRadius: 12,
                                                display: 'flex',
                                                gap: 14,
                                                alignItems: 'flex-start',
                                                cursor: n.isRead ? 'default' : 'pointer',
                                                background: n.isRead ? 'transparent' : typeInfo.bg,
                                                transition: 'all 0.2s',
                                            }}>
                                            <div style={{
                                                width: 36, height: 36,
                                                borderRadius: 10,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: typeInfo.bg,
                                                color: typeInfo.color,
                                                flexShrink: 0,
                                            }}>
                                                {typeInfo.icon}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 14, marginBottom: 2 }}>{n.title}</div>
                                                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{n.message}</div>
                                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                                                    <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                    {new Date(n.createdAt).toLocaleString('vi-VN')}
                                                </div>
                                            </div>
                                            {!n.isRead && (
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeInfo.color, marginTop: 6, flexShrink: 0 }} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
