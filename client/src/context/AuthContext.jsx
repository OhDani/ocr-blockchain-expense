/**
 * AuthContext.jsx — Quản lý state đăng nhập.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Kiểm tra token khi app load
    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const result = await authAPI.login(email, password);
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        setUser(result.data.user);
        return result.data.user;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const updateUser = (newData) => {
        const updated = { ...user, ...newData };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth phải dùng trong AuthProvider');
    }
    return context;
}
