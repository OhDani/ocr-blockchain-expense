/**
 * Pagination.jsx — Reusable pagination component
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
            >
                <ChevronLeft size={14} /> Trước
            </button>
            <span style={{ padding: '6px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Trang {currentPage} / {totalPages}
            </span>
            <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
            >
                Sau <ChevronRight size={14} />
            </button>
        </div>
    );
}

/**
 * Hook helper: client-side pagination
 */
export function usePagination(items, perPage = 10) {
    const totalPages = Math.ceil(items.length / perPage);
    return {
        totalPages,
        getPage: (page) => items.slice((page - 1) * perPage, page * perPage),
    };
}
