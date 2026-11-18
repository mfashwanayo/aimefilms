const configuredApiBase = ((import.meta as any).env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = configuredApiBase || ((import.meta as any).env?.PROD ? '' : 'http://localhost:8001');

export function getAuthToken(): string | null {
    return localStorage.getItem('aimefilms_token');
}

export function setAuthToken(token: string | null) {
    if (!token) localStorage.removeItem('aimefilms_token');
    else localStorage.setItem('aimefilms_token', token);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('http://') && !path.startsWith('https://') && !API_BASE_URL) {
        throw new Error('The live backend URL is not configured. Set the GitHub Actions variable VITE_API_BASE_URL to your deployed FastAPI service URL.');
    }
    const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE_URL}${path}`;

    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as any),
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            headers,
        });
    } catch (error) {
        // "Failed to fetch" is a network/configuration error, not an invalid
        // password. Give admins the actual API target and likely fixes.
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Cannot reach the AimeFilms API at ${url}. Check that the backend service is deployed and running, VITE_API_BASE_URL points to its public HTTPS URL, and FRONTEND_ORIGINS in the backend includes this website's exact origin. Browser error: ${detail}`
        );
    }

    const text = await res.text();
    if (!res.ok) {
        let message = text || `HTTP ${res.status}`;
        try {
            const body = JSON.parse(text);
            message = body?.message || body?.detail || body?.error || message;
        } catch {
            // Keep raw response text when it is not JSON.
        }
        throw new Error(message);
    }

    return (text ? JSON.parse(text) : {}) as T;
}

