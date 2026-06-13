export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8080';

export function getAuthToken(): string | null {
    return localStorage.getItem('aimefilms_token');
}

export function setAuthToken(token: string | null) {
    if (!token) localStorage.removeItem('aimefilms_token');
    else localStorage.setItem('aimefilms_token', token);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE_URL}${path}`;

    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as any),
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
        ...init,
        headers,
    });

    const text = await res.text();
    if (!res.ok) {
        try {
            const j = JSON.parse(text);
            throw new Error(j?.message || `HTTP ${res.status}`);
        } catch {
            throw new Error(text || `HTTP ${res.status}`);
        }
    }

    return (text ? JSON.parse(text) : {}) as T;
}

