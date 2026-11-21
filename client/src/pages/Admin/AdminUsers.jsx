/**
 * AdminUsers.jsx — Quản lý danh sách nhân viên (Admin & Manager)
 * Hỗ trợ tạo đơn lẻ với đuôi domain công ty, tạo hàng loạt (Excel/Dán) & giám sát ví Web3
 */

import { useState, useEffect, useMemo } from 'react';
import { adminAPI, getAssetUrl } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
    Users, Shield, UserCheck, Search, Plus, X, Trash2,
    FileSpreadsheet, Download, UploadCloud, CheckCircle2,
    AlertCircle, Wallet
} from 'lucide-react';
import Pagination, { usePagination } from '../../components/Pagination/Pagination.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as XLSX from 'xlsx';

const ROLE_MAP = {
    ADMIN: { label: 'Quản trị viên', icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    MANAGER: { label: 'Trưởng phòng', icon: UserCheck, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    EMPLOYEE: { label: 'Nhân viên', icon: Users, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
};

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'ADMIN';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterRole, setFilterRole] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const toast = useToast();

    // Modal & Form State
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'
    const [creating, setCreating] = useState(false);
    const [dbDepartments, setDbDepartments] = useState([]);
    const [allowedDomains, setAllowedDomains] = useState(['company.vn', 'vku.udn.vn']);

    // Form Tạo đơn lẻ
    const [form, setForm] = useState({
        name: '',
        emailPrefix: '',
        domain: 'company.vn',
        password: 'employee123',
        role: 'EMPLOYEE',
        departmentId: '',
    });

    // Form Tạo hàng loạt
    const [bulkText, setBulkText] = useState('');
    const [bulkDepartmentId, setBulkDepartmentId] = useState('');
    const [bulkRole, setBulkRole] = useState('EMPLOYEE');
    const [bulkDomain, setBulkDomain] = useState('company.vn');
    const [bulkPassword, setBulkPassword] = useState('employee123');
    const [bulkCreating, setBulkCreating] = useState(false);

    const fetchUsers = () => {
        setLoading(true);
        adminAPI.users()
            .then((res) => {
                setUsers(res.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUsers();
        adminAPI.departmentsList()
            .then(res => setDbDepartments(res.data || []))
            .catch(console.error);

        adminAPI.domains()
            .then(res => {
                if (res.data && res.data.length > 0) {
                    setAllowedDomains(res.data);
                    setForm(prev => ({ ...prev, domain: res.data[0] }));
                    setBulkDomain(res.data[0]);
                }
            })
            .catch(() => {});
    }, []);

    // Danh sách phòng ban unique cho bộ lọc
    const departments = useMemo(() => {
        const depts = [...new Set(users.map(u => u.department?.name).filter(Boolean))];
        return depts.sort();
    }, [users]);

    // Lọc danh sách
    const filtered = useMemo(() => {
        return users.filter(u => {
            if (filterRole && u.role !== filterRole) return false;
            if (filterDept && u.department?.name !== filterDept) return false;
            if (search) {
                const q = search.toLowerCase();
                if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [users, filterRole, filterDept, search]);

    useEffect(() => { setPage(1); }, [filterRole, filterDept, search]);

    const { totalPages, getPage } = usePagination(filtered, 10);
    const paginatedUsers = getPage(page);

    // Thống kê vai trò
    const roleCounts = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {});

    // Xử lý tạo 1 nhân viên
    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const domainClean = form.domain.replace(/^@/, '');
            const fullEmail = `${form.emailPrefix.trim().toLowerCase()}@${domainClean}`;

            const payload = {
                name: form.name.trim(),
                email: fullEmail,
                password: form.password || 'employee123',
                role: isAdmin ? form.role : 'EMPLOYEE',
                departmentId: isAdmin ? (form.departmentId || null) : (currentUser?.departmentId || null),
            };

            await adminAPI.createUser(payload);
            toast('Tạo tài khoản nhân viên thành công!', 'success');
            setShowForm(false);
            setForm({
                name: '',
                emailPrefix: '',
                domain: allowedDomains[0] || 'company.vn',
                password: 'employee123',
                role: 'EMPLOYEE',
                departmentId: '',
            });
            fetchUsers();
        } catch (err) {
            toast(err.message || 'Lỗi tạo nhân viên', 'error');
        } finally {
            setCreating(false);
        }
    };

    // Phân tích danh sách nhập hàng loạt (từ Textarea hoặc Excel)
    const parsedBulkUsers = useMemo(() => {
        if (!bulkText.trim()) return [];
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
        const seenInBatch = new Set();
        const domainClean = bulkDomain.replace(/^@/, '');

        return lines.map((line, idx) => {
            const parts = line.split(/[,\t;]/).map(p => p.trim()).filter(Boolean);
            let name = parts[0] || '';
            let rawEmail = parts[1] || '';

            if (parts.length === 1) {
                if (parts[0].includes('@')) {
                    rawEmail = parts[0];
                    name = parts[0].split('@')[0];
                } else {
                    name = parts[0];
                    rawEmail = parts[0].toLowerCase().replace(/\s+/g, '.');
                }
            }

            let fullEmail = rawEmail;
            if (!fullEmail.includes('@')) {
                fullEmail = `${rawEmail.replace(/@.*$/, '')}@${domainClean}`;
            }
            fullEmail = fullEmail.toLowerCase();

            let status = 'VALID';
            let statusMessage = 'Hợp lệ';

            if (!name) {
                status = 'INVALID';
                statusMessage = 'Thiếu họ tên';
            } else if (!rawEmail) {
                status = 'INVALID';
                statusMessage = 'Thiếu email';
            } else if (existingEmails.has(fullEmail)) {
                status = 'DUPLICATE';
                statusMessage = 'Email đã tồn tại';
            } else if (seenInBatch.has(fullEmail)) {
                status = 'DUPLICATE_BATCH';
                statusMessage = 'Trùng trong danh sách';
            } else {
                seenInBatch.add(fullEmail);
            }

            return {
                id: idx + 1,
                name,
                email: fullEmail,
                status,
                statusMessage,
            };
        });
    }, [bulkText, bulkDomain, users]);

    // Tải file mẫu Excel
    const handleDownloadTemplate = () => {
        const domainClean = bulkDomain.replace(/^@/, '');
        const wsData = [
            ['Họ và tên', 'Email hoặc Tên đăng nhập', 'Ghi chú'],
            ['Nguyễn Văn A', 'nguyenvana', `Có thể nhập username (tự ghép @${domainClean})`],
            ['Trần Thị B', `tranthib@${domainClean}`, 'Hoặc nhập email đầy đủ'],
            ['Lê Văn C', 'levanc', 'Mật khẩu khởi tạo chung: employee123'],
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachNhanVien');
        XLSX.writeFile(wb, 'mau_nhap_nhan_vien.xlsx');
        toast('Đã tải xuống file mẫu mau_nhap_nhan_vien.xlsx', 'info');
    };

    // Đọc file Excel tải lên
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (!rows || rows.length < 2) {
                    toast('File không chứa dòng dữ liệu nhân viên', 'warning');
                    return;
                }
                const dataRows = rows.slice(1);
                const lines = dataRows
                    .filter(r => r && (r[0] || r[1]))
                    .map(r => `${r[0] || ''}, ${r[1] || ''}`);
                setBulkText(lines.join('\n'));
                toast(`Đã đọc ${lines.length} dòng dữ liệu từ file Excel!`, 'success');
            } catch (err) {
                toast('Lỗi đọc file Excel: ' + err.message, 'error');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // Gửi yêu cầu tạo hàng loạt
    const handleBulkSubmit = async () => {
        const validItems = parsedBulkUsers.filter(u => u.status === 'VALID');
        if (validItems.length === 0) {
            toast('Không có nhân viên hợp lệ nào để tạo', 'warning');
            return;
        }
        setBulkCreating(true);
        try {
            const payload = {
                users: validItems.map(u => ({ name: u.name, email: u.email })),
                defaultDepartmentId: isAdmin ? (bulkDepartmentId || null) : (currentUser?.departmentId || null),
                defaultRole: isAdmin ? bulkRole : 'EMPLOYEE',
                defaultPassword: bulkPassword || 'employee123',
            };
            const res = await adminAPI.bulkCreateUsers(payload);
            toast(res.message || `Đã tạo ${validItems.length} nhân viên thành công!`, 'success');
            setShowForm(false);
            setBulkText('');
            fetchUsers();
        } catch (err) {
            toast(err.message || 'Lỗi tạo nhân viên hàng loạt', 'error');
        } finally {
            setBulkCreating(false);
        }
    };

    // Xóa nhân viên
    const handleDeleteUser = async (user) => {
        const confirm = window.confirm(`Bạn chắc chắn muốn xóa nhân viên "${user.name}"?\n\nTất cả dữ liệu (hóa đơn, chuyến công tác) của nhân viên này sẽ bị xóa vĩnh viễn.`);
        if (!confirm) return;
        try {
            await adminAPI.deleteUser(user.id);
            toast(`Đã xóa nhân viên ${user.name}`, 'success');
            fetchUsers();
        } catch (err) {
            toast(err.message || 'Lỗi xóa nhân viên', 'error');
        }
    };

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const validBulkCount = parsedBulkUsers.filter(u => u.status === 'VALID').length;

    return (
        <div>
            {/* ── Tiêu đề trang ── */}
            <div className="page-header">
                <div>
                    <h1>Danh sách nhân viên</h1>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        {users.length} người dùng hệ thống
                    </span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={16} /> Thêm nhân viên
                </button>
            </div>

            {/* ── Modal Thêm nhân viên (2 Tabs: Đơn lẻ & Hàng loạt) ── */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: activeTab === 'bulk' ? 680 : 520, transition: 'max-width 0.25s ease' }}
                    >
                        <div className="modal-header">
                            <h2 className="modal-header__title">Tạo tài khoản nhân viên</h2>
                            <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>

                        {/* Tabs chuyển đổi hình thức */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 18 }}>
                            <button
                                type="button"
                                onClick={() => setActiveTab('single')}
                                style={{
                                    padding: '10px 18px',
                                    border: 'none',
                                    background: 'none',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: activeTab === 'single' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    borderBottom: activeTab === 'single' ? '2px solid var(--color-primary)' : 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                Thêm 1 nhân viên
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('bulk')}
                                style={{
                                    padding: '10px 18px',
                                    border: 'none',
                                    background: 'none',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: activeTab === 'bulk' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    borderBottom: activeTab === 'bulk' ? '2px solid var(--color-primary)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <FileSpreadsheet size={15} /> Thêm hàng loạt (Excel / Dán)
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* ── Tab 1: Thêm 1 nhân viên ── */}
                            {activeTab === 'single' ? (
                                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div className="form-group">
                                        <label>Họ và tên *</label>
                                        <input
                                            className="form-input"
                                            required
                                            placeholder="ví dụ: Nguyễn Văn An"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Email với đuôi Domain chọn lọc */}
                                    <div className="form-group">
                                        <label>Email công tác *</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input
                                                className="form-input"
                                                type="text"
                                                required
                                                placeholder="tên đăng nhập (vd: nguyenvana)"
                                                value={form.emailPrefix}
                                                onChange={(e) => setForm({ ...form, emailPrefix: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                                                style={{ flex: 1 }}
                                            />
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                background: 'var(--color-bg)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 8,
                                                padding: '0 8px',
                                                height: 38,
                                            }}>
                                                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, marginRight: 2 }}>@</span>
                                                <select
                                                    value={form.domain}
                                                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 500, color: 'var(--color-text)', cursor: 'pointer' }}
                                                >
                                                    {allowedDomains.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <small style={{ color: 'var(--color-text-muted)', fontSize: 11, marginTop: 4 }}>
                                            Tên miền email chuẩn theo cấu hình cho phép của tổ chức
                                        </small>
                                    </div>

                                    <div className="form-group">
                                        <label>Mật khẩu khởi tạo *</label>
                                        <input
                                            className="form-input"
                                            type="text"
                                            required
                                            minLength={6}
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        />
                                        <small style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                                            Mặc định: <strong>employee123</strong> (nhân viên tự đổi sau khi đăng nhập)
                                        </small>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div className="form-group">
                                            <label>Vai trò *</label>
                                            {isAdmin ? (
                                                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                                    <option value="EMPLOYEE">Nhân viên</option>
                                                    <option value="MANAGER">Trưởng phòng</option>
                                                    <option value="ADMIN">Quản trị viên</option>
                                                </select>
                                            ) : (
                                                <input className="form-input" value="Nhân viên" disabled />
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label>Phòng ban</label>
                                            {isAdmin ? (
                                                <select className="form-input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                                                    <option value="">-- Chưa phân phòng --</option>
                                                    {dbDepartments.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input className="form-input" value={dbDepartments.find(d => d.id === currentUser?.departmentId)?.name || 'Phòng ban của bạn'} disabled />
                                            )}
                                        </div>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={creating} style={{ marginTop: 8 }}>
                                        {creating ? 'Đang tạo...' : 'Lưu tài khoản'}
                                    </button>
                                </form>
                            ) : (
                                /* ── Tab 2: Thêm hàng loạt ── */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {/* Cấu hình chung cho mẻ tạo */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, background: 'var(--color-bg)', borderRadius: 8 }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: 12 }}>Phòng ban phân bổ</label>
                                            {isAdmin ? (
                                                <select
                                                    className="form-input"
                                                    value={bulkDepartmentId}
                                                    onChange={(e) => setBulkDepartmentId(e.target.value)}
                                                    style={{ height: 36, fontSize: 12 }}
                                                >
                                                    <option value="">-- Chưa phân phòng --</option>
                                                    {dbDepartments.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    className="form-input"
                                                    value={dbDepartments.find(d => d.id === currentUser?.departmentId)?.name || 'Phòng ban của bạn'}
                                                    disabled
                                                    style={{ height: 36, fontSize: 12 }}
                                                />
                                            )}
                                        </div>

                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: 12 }}>Đuôi domain mặc định</label>
                                            <select
                                                className="form-input"
                                                value={bulkDomain}
                                                onChange={(e) => setBulkDomain(e.target.value)}
                                                style={{ height: 36, fontSize: 12 }}
                                            >
                                                {allowedDomains.map(d => (
                                                    <option key={d} value={d}>@{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Công cụ hỗ trợ tải mẫu & upload file */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontWeight: 600, fontSize: 13 }}>Danh sách nhân viên (Dán hoặc Nhập từ Excel):</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                onClick={handleDownloadTemplate}
                                                className="btn btn-sm btn-secondary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                            >
                                                <Download size={13} /> Tải file mẫu .xlsx
                                            </button>
                                            <label
                                                className="btn btn-sm btn-secondary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}
                                            >
                                                <UploadCloud size={13} /> Nhập từ Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx,.xls,.csv"
                                                    onChange={handleFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Textarea dán trực tiếp */}
                                    <textarea
                                        rows={4}
                                        className="form-input"
                                        placeholder={`Dán danh sách (mỗi dòng: Họ tên, email_hoặc_username):\nVí dụ:\nNguyễn Văn An, nguyenvana\nTrần Thị Bích, tranthib@company.vn`}
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                                    />

                                    {/* Bảng Xem trước (Preview) */}
                                    {parsedBulkUsers.length > 0 && (
                                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                                            <div style={{ padding: '8px 12px', background: 'var(--color-bg)', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Xem trước danh sách ({parsedBulkUsers.length} dòng)</span>
                                                <span style={{ color: validBulkCount > 0 ? '#10b981' : '#ef4444' }}>
                                                    {validBulkCount} hợp lệ
                                                </span>
                                            </div>
                                            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                    <tbody>
                                                        {parsedBulkUsers.map((item) => (
                                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                                <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>#{item.id}</td>
                                                                <td style={{ padding: '6px 10px', fontWeight: 500 }}>{item.name}</td>
                                                                <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{item.email}</td>
                                                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                                                    {item.status === 'VALID' ? (
                                                                        <span className="badge badge-success" style={{ fontSize: 10 }}>✓ Hợp lệ</span>
                                                                    ) : (
                                                                        <span className="badge badge-danger" style={{ fontSize: 10 }}>{item.statusMessage}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                        Mật khẩu khởi tạo mặc định cho toàn bộ danh sách là: <strong>employee123</strong>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={bulkCreating || validBulkCount === 0}
                                        onClick={handleBulkSubmit}
                                        style={{ marginTop: 4 }}
                                    >
                                        {bulkCreating ? 'Đang tạo danh sách...' : `Xác nhận tạo ${validBulkCount} nhân viên`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Thống kê vai trò ── */}
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

            {/* ── Bộ lọc ── */}
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
                                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            }}
                        >
                            Xóa lọc
                        </button>
                    )}
                </div>
            </div>

            {/* ── Bảng danh sách nhân viên ── */}
            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={thStyle}>Người dùng</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Vai trò</th>
                                <th style={thStyle}>Phòng ban</th>
                                <th style={thStyle}>Ví Web3</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Hóa đơn</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Chuyến CT</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        Không tìm thấy nhân viên phù hợp
                                    </td>
                                </tr>
                            ) : paginatedUsers.map((u) => {
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
                                                        <img src={getAssetUrl(u.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
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
                                            <span style={{ color: u.department?.name ? 'inherit' : 'var(--color-text-muted)' }}>
                                                {u.department?.name || '—'}
                                            </span>
                                        </td>

                                        {/* Cột Ví Web3 — Không áp dụng cho Admin vì Admin không nhận hoàn ứng */}
                                        <td style={tdStyle}>
                                            {u.role === 'ADMIN' ? (
                                                <span className="badge badge-neutral" style={{ fontSize: 11, padding: '3px 8px' }}>
                                                    Quản trị viên
                                                </span>
                                            ) : u.walletAddress ? (
                                                <span className="badge badge-success" style={{ fontSize: 11, padding: '3px 8px' }}>
                                                    Đã liên kết
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning" style={{ fontSize: 11, padding: '3px 8px' }}>
                                                    Chưa liên kết
                                                </span>
                                            )}
                                        </td>

                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.expenses || 0}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>{u._count?.trips || 0}</td>

                                        {/* Cột Hành động (Chỉ giữ nút Xóa nếu không phải tài khoản hiện tại) */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                                                    title="Xóa nhân viên"
                                                    style={{
                                                        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                        border: 'none', borderRadius: 6, padding: '5px 8px',
                                                        cursor: 'pointer', fontSize: 12, display: 'inline-flex',
                                                        alignItems: 'center', gap: 4,
                                                    }}
                                                >
                                                    <Trash2 size={13} /> Xóa
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                {filtered.length > 0 && (
                    <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
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
