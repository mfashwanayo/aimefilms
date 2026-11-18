const configuredApiBase = ((import.meta as any).env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = configuredApiBase || ((import.meta as any).env?.PROD ? '' : 'http://localhost:8001');

function safeStorage(): Storage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

export function getAuthToken(): string | null {
    try {
        return safeStorage()?.getItem('aimefilms_token') ?? null;
    } catch {
        return null;
    }
}

export function setAuthToken(token: string | null): void {
    try {
        const storage = safeStorage();
        if (!storage) return;
        if (!token) storage.removeItem('aimefilms_token');
        else storage.setItem('aimefilms_token', token);
    } catch {
        // Auth state still remains available to the current in-memory session.
    }
}

function parseResponse<T>(text: string, status: number): T {
    if (!text) return {} as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`The AimeFilms API returned an invalid response (HTTP ${status}). Please retry or contact support.`);
    }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('http://') && !path.startsWith('https://') && !API_BASE_URL) {
        throw new Error('The live backend URL is not configured. Set the GitHub Actions variable VITE_API_BASE_URL to your deployed FastAPI service URL.');
    }
    const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE_URL}${path}`;

    const token = getAuthToken();
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
        response = await fetch(url, { ...init, headers });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Cannot reach the AimeFilms API at ${url}. Check that the backend is deployed and running, VITE_API_BASE_URL points to its public HTTPS URL, and FRONTEND_ORIGINS includes this website's exact origin. Browser error: ${detail}`
        );
    }

    const responseText = await response.text();
    const body = parseResponse<any>(responseText, response.status);
    if (!response.ok) {
        const message = body?.message || body?.detail || body?.error || `The request failed (HTTP ${response.status}).`;
        throw new Error(message);
    }
    return body as T;
}
