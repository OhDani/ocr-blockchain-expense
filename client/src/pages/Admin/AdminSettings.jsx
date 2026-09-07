/**
 * AdminSettings.jsx — Cấu hình hệ thống (Hạn mức, Phòng ban, Nhật ký)
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Settings, Users, Shield, History, Plus, Save, Trash2, ShieldAlert } from 'lucide-react';
import './AdminSettings.css';

const formatNumber = (val) => {
    if (val == null) return '';
    const num = val.toString().replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function AdminSettings() {
    const [activeTab, setActiveTab] = useState('policy');
    const toast = useToast();

    return (
        <div>
            <div className="page-header">
                <h1>Cấu hình hệ thống</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Quản lý hạn mức chi tiêu, phòng ban và nhật ký hệ thống</p>
            </div>

            <div className="settings-tabs">
                <button className={`settings-tab ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>
                    <Shield size={16} /> Hạn mức chi tiêu
                </button>
                <button className={`settings-tab ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
                    <Users size={16} /> Phòng ban
                </button>
                <button className={`settings-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                    <History size={16} /> Nhật ký hệ thống
                </button>
            </div>

            <div className="card">
                {activeTab === 'policy' && <PolicyTab toast={toast} />}
                {activeTab === 'departments' && <DepartmentsTab toast={toast} />}
                {activeTab === 'audit' && <AuditLogTab toast={toast} />}
            </div>
        </div>
    );
}

function PolicyTab({ toast }) {
    const [limits, setLimits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);

    useEffect(() => {
        adminAPI.policyLimits().then(res => setLimits(res.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const handleSave = async (limit) => {
        setSaving(limit.id);
        try {
            await adminAPI.updatePolicyLimit(limit.id, {
                dailyLimit: Number(limit.dailyLimit),
                perInvoiceLimit: Number(limit.perInvoiceLimit),
                totalPerTripLimit: Number(limit.totalPerTripLimit)
            });
            toast('Cập nhật hạn mức thành công!', 'success');
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const translateRole = (r) => r === 'ADMIN' ? 'Quản trị viên' : r === 'MANAGER' ? 'Quản lý' : 'Nhân viên';

    return (
        <div>
            <h3 style={{ marginBottom: 20 }}>Hạn mức chi tiêu tự động (AI Policy Engine)</h3>
            <div style={{ display: 'grid', gap: 20 }}>
                {limits.map((l, index) => (
                    <div key={l.id} className="policy-card">
                        <div className="policy-header">
                            <h4>{translateRole(l.role)}</h4>
                            <span className="badge badge-info">{l.role}</span>
                        </div>
                        <div className="policy-grid">
                            <div className="form-group">
                                <label>Giới hạn/Ngày (VND)</label>
                                <input type="text" className="form-input" value={formatNumber(l.dailyLimit)}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        const newLimits = [...limits];
                                        newLimits[index].dailyLimit = raw;
                                        setLimits(newLimits);
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Giới hạn/Hoá đơn (VND)</label>
                                <input type="text" className="form-input" value={formatNumber(l.perInvoiceLimit)}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        const newLimits = [...limits];
                                        newLimits[index].perInvoiceLimit = raw;
                                        setLimits(newLimits);
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tổng ngân sách chuyến đi (VND)</label>
                                <input type="text" className="form-input" value={formatNumber(l.totalPerTripLimit)}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        const newLimits = [...limits];
                                        newLimits[index].totalPerTripLimit = raw;
                                        setLimits(newLimits);
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: 16 }}>
                            <button className="btn btn-primary" onClick={() => handleSave(l)} disabled={saving === l.id}>
                                <Save size={14} style={{ marginRight: 6 }} /> Lưu thay đổi
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DepartmentsTab({ toast }) {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchDepts = () => {
        setLoading(true);
        adminAPI.departmentsList().then(res => setDepartments(res.data)).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchDepts(); }, []);

    const handleCreate = async () => {
        if (!newName) return toast('Nhập tên phòng ban', 'warning');
        setCreating(true);
        try {
            await adminAPI.createDepartment({ name: newName, description: newDesc });
            toast('Thêm phòng ban thành công', 'success');
            setNewName(''); setNewDesc('');
            fetchDepts();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Chắc chắn xóa phòng ban này?')) return;
        try {
            await adminAPI.deleteDepartment(id);
            toast('Đã xóa', 'success');
            fetchDepts();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3>Quản lý Phòng Ban</h3>
            </div>

            <div className="policy-card" style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12 }}>Thêm mới phòng ban</h4>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <input type="text" className="form-input" placeholder="Tên phòng ban..." value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1 }} />
                    <input type="text" className="form-input" placeholder="Mô tả..." value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ flex: 2 }} />
                    <button className="btn btn-primary" onClick={handleCreate} disabled={creating}><Plus size={16} /> Thêm</button>
                </div>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>Tên phòng ban</th>
                        <th>Mô tả</th>
                        <th>Nhân sự</th>
                        <th>Ngày tạo</th>
                        <th style={{ width: 80 }}>Công cụ</th>
                    </tr>
                </thead>
                <tbody>
                    {departments.map(d => (
                        <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                            <td style={{ color: 'var(--color-text-secondary)' }}>{d.description || '—'}</td>
                            <td><span className="badge badge-info">{d._count?.users || 0}</span></td>
                            <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{new Date(d.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)} disabled={d._count?.users > 0} title={d._count?.users > 0 ? 'Phòng ban đang có người' : 'Xóa'}>
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {departments.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>Chưa có phòng ban nào</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}


function AuditLogTab({ toast }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminAPI.auditLogs().then(res => setLogs(res.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const ACTION_MAP = {
        'APPROVE_EXPENSE': { label: 'Duyệt chi phí', color: '#10b981' },
        'RETRY_EXPENSE_BLOCKCHAIN': { label: 'Thử lại Blockchain', color: '#8b5cf6' },
        'REJECT_EXPENSE': { label: 'Từ chối chi phí', color: '#ef4444' },
        'UPDATE_POLICY': { label: 'Cập nhật hạn mức', color: '#f59e0b' },
        'CREATE_USER': { label: 'Tạo tài khoản', color: '#3b82f6' },
    };

    /** Chuyển details JSON sang tiếng Việt dễ đọc */
    const formatDetails = (details) => {
        if (!details || typeof details !== 'object') return null;
        const labelMap = {
            amount: 'Số tiền',
            newStatus: 'Trạng thái mới',
            reason: 'Lý do',
            role: 'Vai trò',
            dailyLimit: 'Hạn mức/ngày',
            perInvoiceLimit: 'Hạn mức/hóa đơn',
            totalPerTripLimit: 'Hạn mức/chuyến',
        };
        const statusMap = {
            APPROVED: 'Đã duyệt',
            REIMBURSED: 'Đã hoàn ứng',
            REJECTED: 'Bị từ chối',
            PENDING: 'Đang chờ duyệt',
        };
        const entries = Object.entries(details).filter(([, v]) => v != null);
        if (entries.length === 0) return null;
        return entries.map(([key, value]) => {
            const label = labelMap[key] || key;
            let display = value;
            if (key === 'amount' || key === 'dailyLimit' || key === 'perInvoiceLimit' || key === 'totalPerTripLimit') {
                display = Number(value).toLocaleString('vi-VN') + 'đ';
            } else if (key === 'newStatus') {
                display = statusMap[value] || value;
            }
            return `${label}: ${display}`;
        }).join(' · ');
    };

    return (
        <div>
            <h3 style={{ marginBottom: 20 }}>Lịch sử hoạt động Hệ thống</h3>
            {logs.length === 0 ? (
                <div className="empty-state">
                    <ShieldAlert size={40} style={{ opacity: 0.5 }} />
                    <div className="empty-state__text">Chưa có bản ghi nhật ký</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {logs.map(log => {
                        const act = ACTION_MAP[log.action] || { label: log.action, color: '#64748b' };
                        const detailStr = formatDetails(log.details);
                        return (
                            <div key={log.id} style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ minWidth: 140 }}>
                                    <div style={{ fontWeight: 600, color: act.color, fontSize: 13, marginBottom: 4 }}>{act.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: 14 }}>{log.user?.name || 'Hệ thống'} <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>({log.user?.email})</span></div>
                                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                                        Đối tượng: <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{log.entity} #{log.entityId?.substring(0, 8)}</code>
                                    </div>
                                    {detailStr && (
                                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                            {detailStr}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
