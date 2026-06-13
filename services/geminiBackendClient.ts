import { Language, StreamingService, ChatMessage } from '../types';

export type GeminiStudioAction = {
    type: 'FILTER' | 'SEARCH' | 'ADMIN_AUTH_SUCCESS' | 'ADMIN_VIEW_USERS' | 'GET_USER_DOCUMENT' | 'PASSWORD_RECOVERY' | 'NONE';
    value: string;
};

export type GeminiStudioResponse = {
    narrative: string;
    action?: GeminiStudioAction;
};

const AI_BASE_URL = (import.meta as any).env?.VITE_AI_BASE_URL || 'http://localhost:8001';

export async function getAIStudioResponseViaBackend(params: {
    userPrompt: string;
    language?: Language;
    isCurrentlyAuthenticated?: boolean;
    currentMovieTitle?: string;
    userRole?: string;
    movies?: StreamingService[];
    history?: ChatMessage[];
}): Promise<GeminiStudioResponse> {
    const res = await fetch(`${AI_BASE_URL}/ai/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userPrompt: params.userPrompt,
            language: params.language || 'EN',
            isCurrentlyAuthenticated: params.isCurrentlyAuthenticated || false,
            currentMovieTitle: params.currentMovieTitle,
            userRole: params.userRole,
            movies: params.movies || [],
            history: params.history || [],
        }),
    });

    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { narrative: text, action: { type: 'NONE', value: '' } };
    }
}

