/**
 * AdminSettings.jsx — Cấu hình hệ thống (Hạn mức, Phòng ban, Nhật ký)
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Settings, Users, Shield, History, Plus, Save, Trash2, ShieldAlert, Globe, ShieldCheck } from 'lucide-react';
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
                <button className={`settings-tab ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => setActiveTab('domains')}>
                    <Globe size={16} /> Tên miền Google SSO
                </button>
                <button className={`settings-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                    <History size={16} /> Nhật ký hệ thống
                </button>
            </div>

            <div className="card">
                {activeTab === 'policy' && <PolicyTab toast={toast} />}
                {activeTab === 'departments' && <DepartmentsTab toast={toast} />}
                {activeTab === 'domains' && <DomainsTab toast={toast} />}
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

function DomainsTab({ toast }) {
    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(null);

    const fetchDomains = async () => {
        try {
            const res = await adminAPI.domains();
            if (res.success && res.data) {
                setDomains(res.data);
            }
        } catch (err) {
            console.error('Lỗi tải danh sách domain:', err);
            toast('Không thể tải danh sách tên miền: ' + (err.message || ''), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDomains();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        const trimmed = newDomain.trim();
        if (!trimmed) {
            toast('Vui lòng nhập tên miền', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const res = await adminAPI.addDomain(trimmed);
            if (res.success) {
                toast(res.message || 'Đã cấp phép tên miền thành công!', 'success');
                setDomains(res.data);
                setNewDomain('');
            }
        } catch (err) {
            toast(err.message || 'Lỗi khi thêm tên miền', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (domain) => {
        if (!window.confirm(`Bạn có chắc muốn xóa quyền truy cập của tên miền @${domain}? Người dùng email đuôi này sẽ không thể đăng nhập Google SSO nữa.`)) {
            return;
        }

        setDeleting(domain);
        try {
            const res = await adminAPI.removeDomain(domain);
            if (res.success) {
                toast(res.message || `Đã xóa tên miền @${domain}`, 'success');
                setDomains(res.data);
            }
        } catch (err) {
            toast(err.message || 'Lỗi khi xóa tên miền', 'error');
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <span className="spinner" style={{ width: 24, height: 24 }} />
                <div style={{ marginTop: 12, color: 'var(--color-text-muted)', fontSize: 13 }}>Đang tải danh sách tên miền...</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 0' }}>
                    <Globe size={18} color="var(--color-primary)" /> Quản lý Tên miền Google SSO (Domain Whitelist)
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                    Chỉ cho phép các tài khoản email thuộc các tên miền dưới đây đăng nhập bằng <strong>Google Identity Services (OAuth 2.0)</strong>. Hệ thống tự động chặn mọi email cá nhân lạ (như @gmail.com). Khi thêm hoặc xóa ở đây, hệ thống <strong>áp dụng tức thì theo thời gian thực mà không cần khởi động lại máy chủ</strong>.
                </p>
            </div>

            {/* Form thêm domain */}
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 28, maxWidth: 580 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 600 }}>@</span>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Nhập tên miền mới (ví dụ: vku.udn.vn, fpt.edu.vn, company.vn)"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        style={{ paddingLeft: 32 }}
                        disabled={submitting}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !newDomain.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                    {submitting ? (
                        <>
                            <span className="spinner" style={{ width: 14, height: 14 }} />
                            <span>Đang thêm...</span>
                        </>
                    ) : (
                        <>
                            <Plus size={16} />
                            <span>Cấp phép Domain</span>
                        </>
                    )}
                </button>
            </form>

            {/* Danh sách domain đang cấp phép */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                    Tên miền đang được cấp phép ({domains.length}):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {domains.map((dom) => (
                        <div
                            key={dom}
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--color-bg-secondary, #f8fafc)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
                                        @{dom}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        ● Đang kích hoạt
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDelete(dom)}
                                disabled={deleting === dom}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 6,
                                    borderRadius: 6,
                                    color: 'var(--color-text-muted)',
                                    transition: 'all 0.2s',
                                }}
                                title={`Xóa quyền truy cập của tên miền @${dom}`}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                            >
                                {deleting === dom ? (
                                    <span className="spinner" style={{ width: 14, height: 14 }} />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
