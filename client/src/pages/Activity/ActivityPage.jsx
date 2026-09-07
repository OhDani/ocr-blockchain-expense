/**
 * ActivityPage.jsx — Lịch sử hoạt động cá nhân (Employee & Manager)
 */

import { useState, useEffect } from 'react';
import { userAPI } from '../../api/client.js';
import { Activity, FileUp, Check, XCircle, RefreshCw, Link2, Clock } from 'lucide-react';

const TYPE_MAP = {
    SUBMIT: { label: 'Nộp hóa đơn', icon: <FileUp size={16} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    APPROVE: { label: 'Được duyệt', icon: <Check size={16} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
    REJECT: { label: 'Bị từ chối', icon: <XCircle size={16} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    RETRY: { label: 'Xử lý lại', icon: <RefreshCw size={16} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    BLOCKCHAIN: { label: 'Giao dịch On-chain', icon: <Link2 size={16} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
};

export default function ActivityPage() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        userAPI.activity()
            .then(res => setActivities(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    // Group by date
    const grouped = {};
    activities.forEach(a => {
        const dateKey = new Date(a.timestamp).toLocaleDateString('vi-VN');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(a);
    });

    return (
        <div>
            <div className="page-header">
                <h1><Activity size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Lịch sử hoạt động</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    Dòng thời gian các hoạt động của bạn · {activities.length} sự kiện
                </p>
            </div>

            {activities.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Activity size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                        <div className="empty-state__text">Chưa có hoạt động nào</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {Object.entries(grouped).map(([date, items]) => (
                        <div key={date}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 12, paddingLeft: 4 }}>{date}</div>
                            <div style={{ position: 'relative', paddingLeft: 28 }}>
                                {/* Timeline line */}
                                <div style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: 0,
                                    bottom: 0,
                                    width: 2,
                                    background: 'var(--color-border)',
                                }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {items.map((a, i) => {
                                        const typeInfo = TYPE_MAP[a.type] || { label: a.type, icon: <Activity size={16} />, color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
                                        return (
                                            <div key={i} style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                                {/* Timeline dot */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: -24,
                                                    top: 6,
                                                    width: 12, height: 12,
                                                    borderRadius: '50%',
                                                    background: typeInfo.color,
                                                    border: '2px solid var(--color-background)',
                                                    zIndex: 1,
                                                }} />

                                                <div style={{
                                                    flex: 1,
                                                    padding: '12px 16px',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: 10,
                                                    display: 'flex', gap: 12, alignItems: 'center',
                                                }}>
                                                    <div style={{
                                                        width: 34, height: 34,
                                                        borderRadius: 8,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: typeInfo.bg,
                                                        color: typeInfo.color,
                                                        flexShrink: 0,
                                                    }}>
                                                        {typeInfo.icon}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 500, fontSize: 14 }}>{a.description}</div>
                                                        {a.txHash && (
                                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                                                                TX: <a href={`https://sepolia.etherscan.io/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer"
                                                                    style={{ color: '#2b9e9e', textDecoration: 'none' }}>
                                                                    {a.txHash.substring(0, 12)}...{a.txHash.substring(a.txHash.length - 6)} ↗
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                                        <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                        {new Date(a.timestamp).toLocaleTimeString('vi-VN')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
