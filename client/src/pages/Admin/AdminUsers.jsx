/**
 * AdminUsers.jsx — Danh sách nhân viên (Admin only, view-only + filters)
 */

import { useState, useEffect, useMemo } from 'react';
import { adminAPI } from '../../api/client.js';
import { Users, Shield, UserCheck, Search } from 'lucide-react';

const ROLE_MAP = {
    ADMIN: { label: 'Quản trị viên', icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    MANAGER: { label: 'Trưởng phòng', icon: UserCheck, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    EMPLOYEE: { label: 'Nhân viên', icon: Users, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
};

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        adminAPI.users()
            .then((res) => setUsers(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Lấy danh sách phòng ban unique
    const departments = useMemo(() => {
        const depts = [...new Set(users.map(u => u.department).filter(Boolean))];
        return depts.sort();
    }, [users]);

    // Lọc
    const filtered = useMemo(() => {
        return users.filter(u => {
            if (filterRole && u.role !== filterRole) return false;
            if (filterDept && u.department !== filterDept) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [users, filterRole, filterDept, search]);

    // Thống kê role
    const roleCounts = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {});

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <h1>Danh sách nhân viên</h1>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    {users.length} người dùng
                </span>
            </div>

            {/* Role summary cards */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                {Object.entries(ROLE_MAP).map(([role, info]) => {
                    const Icon = info.icon;
                    return (
                        <div key={role} className="stat-card"
                            onClick={() => setFilterRole(filterRole === role ? '' : role)}
                            style={{ cursor: 'pointer', outline: filterRole === role ? `2px solid ${info.color}` : 'none', outlineOffset: -2 }}
                        >
                            <div className="stat-card__icon" style={{ background: info.bg, color: info.color }}>
                                <Icon size={20} />
                            </div>
                            <div className="stat-card__label">{info.label}</div>
                            <div className="stat-card__value">{roleCounts[role] || 0}</div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Tìm theo tên hoặc email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                                border: '1px solid var(--color-border)', fontSize: 13,
                                background: 'var(--color-bg)',
                            }}
                        />
                    </div>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Tất cả vai trò</option>
                        <option value="EMPLOYEE">Nhân viên</option>
                        <option value="MANAGER">Trưởng phòng</option>
                        <option value="ADMIN">Quản trị viên</option>
                    </select>
                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Tất cả phòng ban</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {(filterRole || filterDept || search) && (
                        <button
                            onClick={() => { setFilterRole(''); setFilterDept(''); setSearch(''); }}
                            style={{
                                padding: '6px 12px', borderRadius: 8, border: 'none',
                                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Users table */}
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={thStyle}>Người dùng</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Vai trò</th>
                                <th style={thStyle}>Phòng ban</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Hóa đơn</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Chuyến CT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        Không tìm thấy nhân viên phù hợp
                                    </td>
                                </tr>
                            ) : filtered.map((u) => {
                                const roleInfo = ROLE_MAP[u.role] || ROLE_MAP.EMPLOYEE;
                                return (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: 'var(--color-accent-bg)', color: 'var(--color-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                                                }}>
                                                    {u.avatarUrl ? (
                                                        <img src={`http://localhost:3000${u.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : u.name?.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{u.email}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                background: roleInfo.bg, color: roleInfo.color,
                                                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                                                borderRadius: 20, display: 'inline-block',
                                            }}>
                                                {roleInfo.label}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ color: u.department ? 'inherit' : 'var(--color-text-muted)' }}>
                                                {u.department || '—'}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.expenses || 0}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.trips || 0}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && (
                    <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
                        Hiển thị {filtered.length} / {users.length} nhân viên
                    </div>
                )}
            </div>
        </div>
    );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };
const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-bg)', minWidth: 140 };
