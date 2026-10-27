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

export async function backendAdminAddMovie(movie: Partial<StreamingService>): Promise<{ success: boolean; movie: StreamingService }> {
    return apiFetch<any>('/api/admin/movies', {
        method: 'POST',
        body: JSON.stringify(movie),
    });
}

type SignedVideoUpload = {
    success: boolean;
    bucket: string;
    path: string;
    signedToken: string;
    uploadEndpoint: string;
    publicUrl: string;
    publishableKey: string;
    sizeBytes: number;
    maxFileSizeBytes: number;
    chunkSizeBytes: number;
    movieId: string;
    field: 'videoUrl' | 'fullMovieUrl';
};

function encodeTusMetadata(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
}

function readableUploadError(responseText: string, fallback: string): string {
    try {
        const body = JSON.parse(responseText);
        return body?.message || body?.error || body?.detail || fallback;
    } catch {
        return responseText || fallback;
    }
}

/**
 * Sends large video files directly from the administrator's browser to Supabase
 * Storage with 6 MiB TUS chunks. FastAPI only issues a short-lived signed token
 * and saves metadata, so the multi-GB video never passes through Render.
 */
export async function backendUploadVideo(
    file: File,
    movieId: string,
    field: 'videoUrl' | 'fullMovieUrl',
    onProgress: (percent: number) => void,
): Promise<{ url: string; path: string }> {
    const maxBytes = 3_900_000_000; // 3.9 decimal GB; actual Supabase plan limits still apply.
    if (file.size <= 0 || file.size > maxBytes) {
        throw new Error('Video must be greater than 0 bytes and no larger than 3.9 GB.');
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeByExtension: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mkv: 'video/x-matroska',
    };
    const contentType = file.type || mimeByExtension[extension];
    if (!contentType || !mimeByExtension[extension]) {
        throw new Error('Supported video types are MP4, WebM, MOV, and MKV.');
    }

    const signed = await apiFetch<SignedVideoUpload>('/api/admin/videos/create-upload', {
        method: 'POST',
        body: JSON.stringify({
            movieId,
            filename: file.name,
            sizeBytes: file.size,
            contentType,
            field,
        }),
    });

    const metadata = [
        ['bucketName', signed.bucket],
        ['objectName', signed.path],
        ['contentType', contentType],
        ['cacheControl', '3600'],
    ].map(([key, value]) => key + ' ' + encodeTusMetadata(value)).join(',');

    const authHeaders: Record<string, string> = {
        apikey: signed.publishableKey,
        'x-signature': signed.signedToken,
        'Tus-Resumable': '1.0.0',
    };

    let createResponse: Response;
    try {
        createResponse = await fetch(signed.uploadEndpoint, {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Upload-Length': String(file.size),
                'Upload-Metadata': metadata,
                'x-upsert': 'false',
            },
        });
    } catch {
        throw new Error('Could not connect to Supabase Storage. Check network access and retry.');
    }
    if (!createResponse.ok) {
        const detail = await createResponse.text();
        throw new Error(readableUploadError(detail, 'Could not start the resumable upload.'));
    }
    const location = createResponse.headers.get('Location');
    if (!location) {
        throw new Error('Supabase did not return a TUS upload location. Check Storage CORS settings.');
    }
    const uploadUrl = new URL(location, signed.uploadEndpoint).toString();
    const chunkSize = Math.min(6 * 1024 * 1024, signed.chunkSizeBytes || 6 * 1024 * 1024);
    let offset = 0;
    onProgress(0);

    while (offset < file.size) {
        const end = Math.min(offset + chunkSize, file.size);
        const chunk = file.slice(offset, end);
        let uploadedChunk = false;
        let lastError = 'A video chunk could not be uploaded.';

        for (let attempt = 0; attempt < 5 && !uploadedChunk; attempt++) {
            try {
                const patchResponse = await fetch(uploadUrl, {
                    method: 'PATCH',
                    headers: {
                        ...authHeaders,
                        'Upload-Offset': String(offset),
                        'Content-Type': 'application/offset+octet-stream',
                    },
                    body: chunk,
                });
                if (patchResponse.ok) {
                    const responseOffset = Number(patchResponse.headers.get('Upload-Offset'));
                    offset = Number.isFinite(responseOffset) && responseOffset > offset ? responseOffset : end;
                    uploadedChunk = true;
                } else {
                    const detail = await patchResponse.text();
                    lastError = readableUploadError(detail, 'Storage returned HTTP ' + patchResponse.status + '.');
                    if (patchResponse.status < 500 && patchResponse.status !== 409 && patchResponse.status !== 408 && patchResponse.status !== 429) {
                        throw new Error(lastError);
                    }
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : lastError;
                if (attempt === 4) break;
            }

            if (!uploadedChunk && attempt < 4) {
                // Recover the server's true upload offset after a network timeout,
                // avoiding duplicate or skipped bytes during the retry.
                try {
                    const headResponse = await fetch(uploadUrl, {
                        method: 'HEAD',
                        headers: authHeaders,
                    });
                    if (headResponse.ok) {
                        const serverOffset = Number(headResponse.headers.get('Upload-Offset'));
                        if (Number.isFinite(serverOffset) && serverOffset >= 0 && serverOffset <= file.size) {
                            offset = serverOffset;
                            if (offset >= end) uploadedChunk = true;
                        }
                    }
                } catch {
                    // The next attempt will retry this chunk.
                }
                if (!uploadedChunk) await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 5000)));
            }
        }
        if (!uploadedChunk) throw new Error(lastError);
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
    }

    const completed = await apiFetch<{ success: boolean; url: string; path: string }>('/api/admin/videos/complete-upload', {
        method: 'POST',
        body: JSON.stringify({
            movieId,
            field,
            path: signed.path,
            sizeBytes: file.size,
        }),
    });
    if (!completed?.success || !completed.url) {
        throw new Error('Video uploaded, but saving its URL to the movie database failed. Retry the save step.');
    }
    onProgress(100);
    return { url: completed.url, path: completed.path };
}
