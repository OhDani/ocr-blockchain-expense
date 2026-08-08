/**
 * ToastContext.jsx — Global toast notification system
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 3500) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map((toast) => {
                        const Icon = ICONS[toast.type] || ICONS.info;
                        return (
                            <div key={toast.id} className={`toast toast-${toast.type}`}>
                                <Icon size={16} />
                                <span className="toast__message">{toast.message}</span>
                                <button className="toast__close" onClick={() => remove(toast.id)}>
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
