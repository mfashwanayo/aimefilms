import { apiFetch, setAuthToken } from './http';
import { StreamingService, User, LogEntry, UserMessage } from '../types';
import { STREAMING_SERVICES } from '../constants';

export type LoginResponse = { success: boolean; token?: string; user?: User; message?: string };

const normalizeMovies = (movies: any[]): StreamingService[] => movies as StreamingService[];

export async function backendLogin(identifier: string, password: string): Promise<LoginResponse> {
    const res = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
    });
    if (res?.success && res?.token) {
        setAuthToken(res.token);
        return { success: true, token: res.token, user: res.user };
    }
    return { success: false, message: res?.message || 'Login failed.' };
}

export async function backendRegister(name: string, email: string, password: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<any>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    });
}

export async function backendGetMovies(): Promise<StreamingService[]> {
    const res = await apiFetch<any>('/api/movies', { method: 'GET' });
    const movies = normalizeMovies(res?.movies || []);
    if (movies.length > 0) return movies;

    try {
        const seeded = await apiFetch<any>('/api/seed', {
            method: 'POST',
            body: JSON.stringify({ movies: STREAMING_SERVICES }),
        });
        return normalizeMovies(seeded?.movies || STREAMING_SERVICES);
    } catch {
        return STREAMING_SERVICES;
    }
}

export async function backendSearchMovies(q: string): Promise<StreamingService[]> {
    const res = await apiFetch<any>(`/api/movies/search?q=${encodeURIComponent(q)}`, { method: 'GET' });
    return normalizeMovies(res?.movies || []);
}

export async function backendTrackView(movieId: string): Promise<void> {
    await apiFetch<any>('/api/views/track', {
        method: 'POST',
        body: JSON.stringify({ movieId }),
    });
}


