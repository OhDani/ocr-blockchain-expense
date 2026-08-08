/**
 * client.js — Axios-style fetch wrapper với JWT interceptor.
 */

const API_BASE = 'http://localhost:3000/api';

/**
 * Gọi API với JWT token tự động.
 */
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    // Nếu body là FormData, không set Content-Type (browser tự set boundary)
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
        // Token hết hạn → logout
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        throw new Error(data.error || 'Có lỗi xảy ra');
    }

    return data;
}

// ──────── Auth ────────
export const authAPI = {
    login: (email, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    getMe: () => request('/auth/me'),
};

// ──────── Trips ────────
export const tripAPI = {
    list: () => request('/trips'),

    get: (id) => request(`/trips/${id}`),

    create: (data) =>
        request('/trips', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id, data) =>
        request(`/trips/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    // Activities (kế hoạch chuyến đi)
    addActivity: (tripId, data) =>
        request(`/trips/${tripId}/activities`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateActivity: (tripId, actId, data) =>
        request(`/trips/${tripId}/activities/${actId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    deleteActivity: (tripId, actId) =>
        request(`/trips/${tripId}/activities/${actId}`, { method: 'DELETE' }),
};

// ──────── Expenses ────────
export const expenseAPI = {
    list: () => request('/expenses'),

    get: (id) => request(`/expenses/${id}`),

    upload: (formData) =>
        request('/expenses/upload', {
            method: 'POST',
            body: formData,
        }),

    approve: (id) =>
        request(`/expenses/${id}/approve`, { method: 'PATCH' }),

    reject: (id, reason) =>
        request(`/expenses/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ reason }),
        }),

    appeal: (id, note) =>
        request(`/expenses/${id}/appeal`, {
            method: 'PATCH',
            body: JSON.stringify({ note }),
        }),

    remove: (id) =>
        request(`/expenses/${id}`, { method: 'DELETE' }),
};

// ──────── Admin ────────
export const adminAPI = {
    dashboard: () => request('/admin/dashboard'),

    expenses: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/admin/expenses?${query}`);
    },

    departments: () => request('/admin/departments'),

    users: () => request('/admin/users'),

    updateUser: (id, data) =>
        request(`/admin/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

// ──────── User ────────
export const userAPI = {
    uploadAvatar: (formData) =>
        request('/user/avatar', {
            method: 'PATCH',
            body: formData,
        }),

    me: () => request('/user/me'),
};

// ──────── Notifications ────────
export const notificationAPI = {
    list: () => request('/notifications'),
    readAll: () => request('/notifications/read-all', { method: 'PATCH' }),
    read: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
};
