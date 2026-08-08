/**
 * AdminDepartments.jsx — Thống kê theo phòng ban (với biểu đồ)
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client.js';
import { BarChart3 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';

const DEPT_COLORS = ['#7c6cf0', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

const formatVND = (v) => v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—';

export default function AdminDepartments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminAPI.departments()
            .then((res) => setDepartments(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-center"><div className="spinner" /></div>;

    const sorted = [...departments].sort((a, b) => b.totalAmount - a.totalAmount);
    const totalAll = sorted.reduce((sum, d) => sum + d.totalAmount, 0) || 1;

    // Pie data
    const pieData = sorted.map((d, i) => ({
        name: d.department,
        value: d.totalAmount,
        color: DEPT_COLORS[i % DEPT_COLORS.length],
    }));

    // Bar data  
    const barData = sorted.map((d, i) => ({
        name: d.department,
        amount: d.totalAmount,
        count: d.count,
        fill: DEPT_COLORS[i % DEPT_COLORS.length],
    }));

    return (
        <div>
            <div className="page-header">
                <h1>Chi phí theo phòng ban</h1>
            </div>

            {sorted.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state__icon"><BarChart3 size={48} strokeWidth={1} /></div>
                        <div className="empty-state__text">Chưa có dữ liệu chi phí</div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Charts row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                        {/* Bar chart: So sánh chi phí */}
                        <div className="card">
                            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>So sánh chi phí</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(203,213,225,0.3)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={{ stroke: 'rgba(203,213,225,0.3)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v}
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={false}
                                        formatter={(value) => [formatVND(value), 'Chi phí']}
                                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
                                    />
                                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                        {barData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pie chart: Tỷ lệ phân bổ */}
                        <div className="card">
                            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Tỷ lệ phân bổ</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => [formatVND(value), 'Chi phí']}
                                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detail table card */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Chi tiết</h3>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Phòng ban</th>
                                    <th>Số hóa đơn</th>
                                    <th>Tổng chi phí</th>
                                    <th>Tỷ lệ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((dept, i) => (
                                    <tr key={dept.department}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{
                                                    width: 10, height: 10, borderRadius: '50%',
                                                    background: DEPT_COLORS[i % DEPT_COLORS.length],
                                                }} />
                                                <span style={{ fontWeight: 500 }}>{dept.department}</span>
                                            </div>
                                        </td>
                                        <td>{dept.count}</td>
                                        <td style={{ fontWeight: 600 }}>{formatVND(dept.totalAmount)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    flex: 1, height: 6, background: 'rgba(124,108,240,0.08)',
                                                    borderRadius: 3, overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 3,
                                                        width: `${(dept.totalAmount / totalAll) * 100}%`,
                                                        background: DEPT_COLORS[i % DEPT_COLORS.length],
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 36 }}>
                                                    {((dept.totalAmount / totalAll) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
