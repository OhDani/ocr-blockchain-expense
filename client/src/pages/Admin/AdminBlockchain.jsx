/**
 * AdminBlockchain.jsx — Blockchain Explorer (Admin only)
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client.js';
import { Link2, Hash, Fuel, Clock, CheckCircle, XCircle } from 'lucide-react';
import Pagination, { usePagination } from '../../components/Pagination/Pagination.jsx';

export default function AdminBlockchain() {
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        adminAPI.blockchain()
            .then(res => setTxs(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const { totalPages, getPage } = usePagination(txs, 10);
    const paginatedTxs = getPage(page);

    return (
        <div>
            <div className="page-header">
                <h1><Link2 size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Blockchain Explorer</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    Lịch sử giao dịch on-chain · {txs.length} giao dịch
                </p>
            </div>

            {/* Thống kê nhanh */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(43,158,158,0.1)', color: '#2b9e9e' }}><Hash size={20} /></div>
                    <div className="stat-card__label">Tổng giao dịch</div>
                    <div className="stat-card__value">{txs.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}><CheckCircle size={20} /></div>
                    <div className="stat-card__label">Thành công</div>
                    <div className="stat-card__value">{txs.filter(t => t.status === 'SUCCESS').length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><XCircle size={20} /></div>
                    <div className="stat-card__label">Thất bại</div>
                    <div className="stat-card__value">{txs.filter(t => t.status === 'FAILED').length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}><Fuel size={20} /></div>
                    <div className="stat-card__label">Tổng Gas</div>
                    <div className="stat-card__value">{txs.reduce((s, t) => s + Number(t.gasUsed || 0), 0).toLocaleString()}</div>
                </div>
            </div>

            {/* Bảng giao dịch */}
            <div className="card">
                {txs.length === 0 ? (
                    <div className="empty-state">
                        <Link2 size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                        <div className="empty-state__text">Chưa có giao dịch blockchain nào</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Trạng thái</th>
                                    <th>TX Hash</th>
                                    <th>Blockchain ID</th>
                                    <th>Gas</th>
                                    <th>Nhân viên</th>
                                    <th>Số tiền</th>
                                    <th>Loại HĐ</th>
                                    <th>Thời gian</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTxs.map(tx => (
                                    <tr key={tx.id}>
                                        <td>
                                            {tx.status === 'SUCCESS' ? (
                                                <span className="badge badge-success">✓ Thành công</span>
                                            ) : (
                                                <span className="badge badge-danger" title={tx.errorMessage}>✗ Lỗi</span>
                                            )}
                                        </td>
                                        <td>
                                            {tx.txHash ? (
                                                <a href={`https://sepolia.etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ textDecoration: 'none' }}>
                                                    <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 4, color: '#2b9e9e', cursor: 'pointer' }}>
                                                        {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 6)} ↗
                                                    </code>
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{tx.blockchainId ?? '—'}</td>
                                        <td style={{ fontSize: 13 }}>{tx.gasUsed ? Number(tx.gasUsed).toLocaleString() : '—'}</td>
                                        <td>
                                            <div style={{ fontWeight: 500, fontSize: 13 }}>{tx.expense?.user?.name || '—'}</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.expense?.user?.email}</div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{tx.expense?.amount ? `${tx.expense.amount.toLocaleString('vi-VN')}đ` : '—'}</td>
                                        <td style={{ fontSize: 13 }}>{tx.expense?.invoiceType || '—'}</td>
                                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </div>
        </div>
    );
}
