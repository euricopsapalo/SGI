import axios from 'axios';
import { showToast, extractErrorMessage } from '../utils/errorHandler';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
    baseURL: `${API_URL}/api`,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sgi_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle responses — auto-logout on 401, global toast on errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('sgi_token');
            if (!window.location.pathname.includes('/login')) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // Show toast for all other errors
        const message = extractErrorMessage(error);
        showToast(message, 'error');

        return Promise.reject(error);
    },
);

export default api;
