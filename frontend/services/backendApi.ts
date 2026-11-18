import { API_BASE_URL, apiFetch, getAuthToken, setAuthToken } from './http';
import { MediaTrack, StreamingService, User, LogEntry, UserMessage } from '../types';

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
    return normalizeMovies(res?.movies || []);
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

export async function backendFetchTmdbMovie(tmdbId: string): Promise<Partial<StreamingService>> {
    const res = await apiFetch<{ success: boolean; movie?: Partial<StreamingService>; message?: string }>(`/api/admin/tmdb/${encodeURIComponent(tmdbId)}`, { method: 'GET' });
    if (!res?.success || !res.movie) throw new Error(res?.message || 'TMDB could not return movie metadata.');
    return res.movie;
}

export async function backendUploadMediaAsset(file: File, movieId: string, kind: 'subtitle' | 'audio', language: string): Promise<MediaTrack> {
    if (!API_BASE_URL && (import.meta as any).env?.PROD) throw new Error('The live backend URL is not configured. Set VITE_API_BASE_URL to the deployed FastAPI service URL.');
    const token = getAuthToken();
    if (!token) throw new Error('Please sign in as an administrator before uploading subtitle or audio files.');
    const form = new FormData(); form.append('file', file, file.name); form.append('movie_id', movieId); form.append('kind', kind); form.append('language', language);
    const base = API_BASE_URL || 'http://localhost:8001';
    const response = await fetch(`${base}/api/admin/media-assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const responseText = await response.text(); let body: any = {};
    try { body = responseText ? JSON.parse(responseText) : {}; } catch { /* use readable HTTP fallback */ }
    if (!response.ok || !body?.success || !body?.track) throw new Error(body?.message || body?.detail || `Media upload failed (HTTP ${response.status}).`);
    return body.track as MediaTrack;
}

export async function backendAdminAddMovie(movie: Partial<StreamingService>): Promise<{ success: boolean; movie: StreamingService }> {
    return apiFetch<any>('/api/admin/movies', {
        method: 'POST',
        body: JSON.stringify(movie),
    });
}

type SignedVideoUpload = {
    success: boolean;
    storageMode?: 'local' | 'supabase';
    bucket?: string;
    path: string;
    signedToken?: string;
    uploadEndpoint?: string;
    publicUrl?: string;
    publishableKey?: string;
    sizeBytes: number;
    maxFileSizeBytes?: number;
    chunkSizeBytes?: number;
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

function uploadVideoToLocalBackend(
    file: File,
    movieId: string,
    field: 'videoUrl' | 'fullMovieUrl',
    onProgress: (percent: number) => void,
): Promise<{ url: string; path: string }> {
    return new Promise((resolve, reject) => {
        const token = getAuthToken();
        if (!token) {
            reject(new Error('Please sign in as an administrator before uploading a video.'));
            return;
        }

        const form = new FormData();
        form.append('file', file, file.name);
        form.append('movie_id', movieId);
        form.append('field', field);

        const base = API_BASE_URL || 'http://localhost:8001';
        const request = new XMLHttpRequest();
        request.open('POST', `${base}/api/admin/videos/upload`);
        request.setRequestHeader('Authorization', `Bearer ${token}`);
        request.upload.onprogress = event => {
            if (event.lengthComputable && event.total > 0) {
                onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
            }
        };
        request.onerror = () => reject(new Error('The local backend could not be reached. Check that FastAPI is running on port 8001.'));
        request.ontimeout = () => reject(new Error('The upload timed out. Check the local backend and retry.'));
        request.onload = () => {
            const body = (() => {
                try { return request.responseText ? JSON.parse(request.responseText) : {}; }
                catch { return {}; }
            })();
            if (request.status < 200 || request.status >= 300 || !body?.success || !body?.url) {
                reject(new Error(body?.message || body?.detail || `Video upload failed (HTTP ${request.status || 'network error'}).`));
                return;
            }
            onProgress(100);
            resolve({ url: body.url, path: body.path || '' });
        };
        request.send(form);
    });
}

/**
 * Selects the configured storage driver. Local development streams a multipart
 * upload to FastAPI's local folders; deployed Supabase mode retains resumable
 * TUS chunks so multi-GB videos do not pass through the Render web process.
 */
export async function backendUploadVideo(
    file: File,
    movieId: string,
    field: 'videoUrl' | 'fullMovieUrl',
    onProgress: (percent: number) => void,
): Promise<{ url: string; path: string }> {
    const maxBytes = 3_900_000_000;
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

    if (signed.storageMode === 'local') {
        return uploadVideoToLocalBackend(file, movieId, field, onProgress);
    }
    if (!signed.bucket || !signed.signedToken || !signed.uploadEndpoint || !signed.publishableKey) {
        throw new Error('The backend returned an incomplete Supabase upload configuration.');
    }

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
        if (createResponse.status === 413 || /entity.?too.?large|file.?size.?limit/i.test(detail)) {
            throw new Error('Supabase rejected this video because the project global upload limit is still 50 MB. Upgrade the Supabase plan and raise Storage → Settings → Global file size limit to at least 3.9 GB.');
        }
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
                    lastError = patchResponse.status === 413
                        ? 'Supabase rejected the file size. The project may still have a 50 MB global file limit; upgrade the plan and raise Storage → Settings → Global file size limit.'
                        : readableUploadError(detail, 'Storage returned HTTP ' + patchResponse.status + '.');
                    if (patchResponse.status < 500 && patchResponse.status !== 409 && patchResponse.status !== 408 && patchResponse.status !== 429) {
                        throw new Error(lastError);
                    }
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : lastError;
                if (attempt === 4) break;
            }

            if (!uploadedChunk && attempt < 4) {
                try {
                    const headResponse = await fetch(uploadUrl, { method: 'HEAD', headers: authHeaders });
                    if (headResponse.ok) {
                        const serverOffset = Number(headResponse.headers.get('Upload-Offset'));
                        if (Number.isFinite(serverOffset) && serverOffset >= 0 && serverOffset <= file.size) {
                            offset = serverOffset;
                            if (offset >= end) uploadedChunk = true;
                        }
                    }
                } catch {
                    // Retry the same chunk if the server's offset cannot be read.
                }
                if (!uploadedChunk) await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 5000)));
            }
        }
        if (!uploadedChunk) throw new Error(lastError);
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
    }

    const completed = await apiFetch<{ success: boolean; url: string; path: string }>('/api/admin/videos/complete-upload', {
        method: 'POST',
        body: JSON.stringify({ movieId, field, path: signed.path, sizeBytes: file.size }),
    });
    if (!completed?.success || !completed.url) {
        throw new Error('Video uploaded, but saving its URL to the movie database failed. Retry the save step.');
    }
    onProgress(100);
    return { url: completed.url, path: completed.path };
}
