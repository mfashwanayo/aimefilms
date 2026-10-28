import { STREAMING_SERVICES } from '../constants';
import { StreamingService, User, UserPost, UserMessage, LogEntry } from '../types';
import { backendLogin, backendRegister, backendGetMovies, backendSearchMovies, backendTrackView } from './backendApi';
import { apiFetch, getAuthToken, setAuthToken } from './http';

// The backend is the source of truth for authentication and shared user messages.

const DB_KEY = 'aimefilms_db_v4';
const USERS_KEY = 'aimefilms_users_v3';
const GALLERY_KEY = 'aimefilms_gallery_v1';
const INBOX_KEY = 'aimefilms_user_inbox_v1';
const ANALYTICS_KEY = 'aimefilms_analytics_v1';
const STATUS_KEY = 'aimefilms_sys_status';
const API_LATENCY = 300;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---- Backend convenience wrappers (fire-and-forget with fallback) ----
async function backendAdminGetAnalytics(): Promise<any> {
  return apiFetch<any>('/api/admin/analytics');
}
async function backendAdminGetUsers(): Promise<any> {
  return apiFetch<any>('/api/admin/users');
}
async function backendAdminGetMovies(): Promise<any> {
  return apiFetch<any>('/api/admin/movies');
}
async function backendAdminToggleBlock(email: string): Promise<any> {
  return apiFetch<any>(`/api/admin/users/${encodeURIComponent(email)}/toggle-block`, { method: 'POST' });
}
async function backendAdminUpdateUser(email: string, updates: Partial<Pick<User, 'name' | 'avatar' | 'language' | 'isVerified' | 'canDownload'>>): Promise<any> {
  return apiFetch<any>(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'PUT', body: JSON.stringify(updates) });
}
async function backendAdminGetLogs(): Promise<any> {
  return apiFetch<any>('/api/admin/logs');
}
async function backendAdminClearLogs(): Promise<any> {
  return apiFetch<any>('/api/admin/logs', { method: 'DELETE' });
}
async function backendAdminGetAllMessages(): Promise<any> {
  return apiFetch<any>('/api/admin/messages');
}
async function backendAdminAddMovie(movie: any): Promise<any> {
  return apiFetch<any>('/api/admin/movies', { method: 'POST', body: JSON.stringify(movie) });
}
async function backendAdminUpdateMovie(id: string, updates: any): Promise<any> {
  return apiFetch<any>(`/api/admin/movies/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}
async function backendAdminDeleteMovie(id: string): Promise<any> {
  return apiFetch<any>(`/api/admin/movies/${id}`, { method: 'DELETE' });
}
async function backendSendMessage(toEmail: string, fromName: string, subject: string, body: string): Promise<any> {
  return apiFetch<any>('/api/messages', { method: 'POST', body: JSON.stringify({ toEmail, fromName, subject, body }) });
}
async function backendGetMessages(): Promise<any> {
  return apiFetch<any>('/api/messages');
}
async function backendMarkMessageRead(id: string): Promise<any> {
  return apiFetch<any>(`/api/messages/${id}/read`, { method: 'POST' });
}
async function backendDeleteMessage(id: string): Promise<any> {
  return apiFetch<any>(`/api/messages/${id}`, { method: 'DELETE' });
}
async function backendSetWatchlist(ids: string[]): Promise<any> {
  return apiFetch<any>('/api/watchlist', { method: 'POST', body: JSON.stringify({ ids }) });
}
async function backendSetContinueWatching(ids: string[]): Promise<any> {
  return apiFetch<any>('/api/continue-watching', { method: 'POST', body: JSON.stringify({ ids }) });
}
async function backendUpdateProfile(name: string, avatar: string): Promise<any> {
  return apiFetch<any>('/api/user/profile', { method: 'PUT', body: JSON.stringify({ name, avatar }) });
}

export class AimeFilmsAPI {
  private static getDB(): StreamingService[] {
    const stored = localStorage.getItem(DB_KEY);
    if (!stored) {
      localStorage.setItem(DB_KEY, JSON.stringify(STREAMING_SERVICES));
      return STREAMING_SERVICES;
    }
    return JSON.parse(stored);
  }

  private static getAnalytics(): { views: Record<string, number>; logs: LogEntry[] } {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    return stored ? JSON.parse(stored) : { views: {}, logs: [] };
  }

  // --- VIEW COUNTS ---
  static getViewCounts(): Record<string, number> {
    return this.getAnalytics().views;
  }

  // --- WATCHLIST ---
  static fetchWatchlist(email: string | undefined): string[] {
    if (!email) return [];
    try {
      return JSON.parse(localStorage.getItem(`aimefilms_watchlist_${email.toLowerCase()}`) || '[]');
    } catch {
      return [];
    }
  }

  static syncWatchlist(email: string | undefined, ids: string[]) {
    if (!email) return;
    localStorage.setItem(`aimefilms_watchlist_${email.toLowerCase()}`, JSON.stringify(ids));
    if (getAuthToken()) {
      backendSetWatchlist(ids).catch(() => { });
    }
  }

  // --- CONTINUE WATCHING ---
  static fetchContinueWatching(email: string | undefined): string[] {
    if (!email) return [];
    try {
      return JSON.parse(localStorage.getItem(`aimefilms_continue_${email.toLowerCase()}`) || '[]');
    } catch {
      return [];
    }
  }

  static async trackMovieView(movieId: string, email?: string) {
    if (getAuthToken()) {
      backendTrackView(movieId).catch(() => { });
    }

    const analytics = this.getAnalytics();
    analytics.views[movieId] = (analytics.views[movieId] || 0) + 1;
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));

    if (email) {
      const current = this.fetchContinueWatching(email);
      const filtered = current.filter(id => id !== movieId);
      const next = [movieId, ...filtered].slice(0, 10);
      localStorage.setItem(`aimefilms_continue_${email.toLowerCase()}`, JSON.stringify(next));
      if (getAuthToken()) {
        backendSetContinueWatching(next).catch(() => { });
      }
    }

    window.dispatchEvent(new CustomEvent('aimefilms_view_updated'));
  }

  // --- MESSAGES ---
  static async submitFeedback(input: { name: string; email?: string; category: string; subject: string; body: string }): Promise<boolean> {
    const result = await apiFetch<{ success?: boolean }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result?.success === true;
  }

  static async sendUserMessage(toEmail: string, fromName: string, subject: string, body: string): Promise<boolean> {
    try {
      if (getAuthToken()) {
        await backendSendMessage(toEmail, fromName, subject, body);
        return true;
      }
    } catch { /* fallback */ }

    await delay(API_LATENCY);
    const stored = localStorage.getItem(INBOX_KEY);
    const inbox: UserMessage[] = stored ? JSON.parse(stored) : [];
    inbox.unshift({
      id: Math.random().toString(36).substr(2, 9),
      toEmail: toEmail.toLowerCase(),
      fromName,
      subject,
      body,
      timestamp: new Date().toISOString(),
      isRead: false
    });
    localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
    return true;
  }

  static async getUserInbox(email: string): Promise<UserMessage[]> {
    try {
      if (getAuthToken()) {
        const res = await backendGetMessages();
        if (res?.success) return res.messages;
      }
    } catch { /* fallback */ }

    await delay(API_LATENCY);
    const stored = localStorage.getItem(INBOX_KEY);
    if (!stored) return [];
    const inbox: UserMessage[] = JSON.parse(stored);
    return inbox.filter(m => m.toEmail.toLowerCase() === email.toLowerCase());
  }

  static async markMessageRead(messageId: string): Promise<boolean> {
    try {
      await backendMarkMessageRead(messageId);
      return true;
    } catch { /* fallback */ }
    const stored = localStorage.getItem(INBOX_KEY);
    if (!stored) return false;
    const inbox: UserMessage[] = JSON.parse(stored);
    const idx = inbox.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      inbox[idx].isRead = true;
      localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
      return true;
    }
    return false;
  }

  static async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await backendDeleteMessage(messageId);
      return true;
    } catch { /* fallback */ }
    const stored = localStorage.getItem(INBOX_KEY);
    if (!stored) return false;
    const inbox: UserMessage[] = JSON.parse(stored);
    const filtered = inbox.filter(m => m.id !== messageId);
    localStorage.setItem(INBOX_KEY, JSON.stringify(filtered));
    return true;
  }

  // --- LOGS ---
  static async addLog(type: LogEntry['type'], details: string, email?: string) {
    const analytics = this.getAnalytics();
    analytics.logs.unshift({
      id: Math.random().toString(36).substr(2, 9),
      type,
      details,
      userEmail: email,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
  }

  static async getLogs(): Promise<LogEntry[]> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to view database logs.');
    const res = await backendAdminGetLogs();
    if (!res?.success || !Array.isArray(res.logs)) throw new Error('Could not load logs from the database.');
    return res.logs;
  }

  static async clearLogs(): Promise<void> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to clear logs.');
    const res = await backendAdminClearLogs();
    if (!res?.success) throw new Error('Could not clear logs in the database.');
  }

  // --- MOVIES ADMIN ---
  static async addMovie(movie: Omit<StreamingService, 'id'>): Promise<StreamingService> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator before uploading a film.');
    const res = await backendAdminAddMovie(movie);
    if (!res?.success || !res.movie?.id) throw new Error('The film was not saved to the database.');
    return res.movie as StreamingService;
  }

  static async updateMovie(id: string, updates: Partial<StreamingService>): Promise<boolean> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator before changing a film.');
    const res = await backendAdminUpdateMovie(id, updates);
    if (!res?.success) throw new Error('The film changes were not saved to the database.');
    return true;
  }

  static async deleteMovie(id: string): Promise<boolean> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator before deleting a film.');
    const res = await backendAdminDeleteMovie(id);
    if (!res?.success) throw new Error('The film could not be deleted from the database.');
    return true;
  }

  // --- INTELLIGENCE / ANALYTICS ---
  static async getAllMessages(): Promise<UserMessage[]> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to view user messages.');
    const res = await backendAdminGetAllMessages();
    if (!res?.success || !Array.isArray(res.messages)) throw new Error('Could not load user messages from the database.');
    return res.messages;
  }

  static async getIntelligenceData() {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to view system insights.');
    const res = await backendAdminGetAnalytics();
    if (!res?.success || !res.analytics) throw new Error('Could not load analytics from the database.');
    return res.analytics;
  }

  // --- AUTH ---
  static async authenticateUser(identifier: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const res = await backendLogin(identifier, password);
      if (res.success && res.user) return { success: true, user: res.user };
      return { success: false, message: res.message || 'Identity check failed.' };
    } catch {
      return { success: false, message: 'Authentication service is unavailable. Please try again.' };
    }
  }

  static async registerUser(userData: Partial<User & { password?: string }>): Promise<{ success: boolean; message: string }> {
    if (!userData.email || !userData.password) {
      return { success: false, message: 'Name, email, and password are required.' };
    }
    try {
      return await backendRegister(userData.name || '', userData.email, userData.password);
    } catch {
      return { success: false, message: 'Registration service is unavailable. Please try again.' };
    }
  }

  private static getUsers(): (User & { password?: string })[] {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private static saveUsers(users: any[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  static async getAllUsers(): Promise<User[]> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to view the user registry.');
    const res = await backendAdminGetUsers();
    if (!res?.success || !Array.isArray(res.users)) throw new Error('Could not load users from the database.');
    return res.users;
  }

  static async getAdminMovies(): Promise<StreamingService[]> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to manage films.');
    const res = await backendAdminGetMovies();
    if (!res?.success || !Array.isArray(res.movies)) throw new Error('Could not load the complete film inventory from the database.');
    return res.movies;
  }

  static async getUserPosts(email: string): Promise<UserPost[]> {
    await delay(API_LATENCY);
    const stored = localStorage.getItem(GALLERY_KEY);
    if (!stored) return [];
    const gallery: UserPost[] = JSON.parse(stored);
    return gallery.filter(p => p.userEmail.toLowerCase() === email.toLowerCase());
  }

  static async updateUserProfile(_email: string, updates: { name: string; avatar: string }): Promise<boolean> {
    if (!getAuthToken()) throw new Error('Please sign in before updating the profile.');
    const res = await backendUpdateProfile(updates.name, updates.avatar);
    if (!res?.success) throw new Error('The profile changes were not saved to the database.');
    return true;
  }

  static async updateManagedUser(email: string, updates: Partial<Pick<User, 'name' | 'avatar' | 'language' | 'isVerified' | 'canDownload'>>): Promise<User> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to manage users.');
    const res = await backendAdminUpdateUser(email, updates);
    if (!res?.success || !res.user?.email) throw new Error('The account changes were not saved to the database.');
    return res.user as User;
  }

  static async toggleUserBlock(email: string): Promise<boolean> {
    if (!getAuthToken()) throw new Error('Please sign in as an administrator to manage users.');
    const res = await backendAdminToggleBlock(email);
    if (!res?.success || typeof res.isBlocked !== 'boolean') throw new Error('The user status was not updated in the database.');
    return true;
  }

  static getSystemStatus(): string {
    return localStorage.getItem(STATUS_KEY) || 'Active';
  }

  // --- MOVIES PUBLIC ---
  static async getMovies(): Promise<StreamingService[]> {
    try {
      return await backendGetMovies();
    } catch { /* fallback */ }
    return this.getDB();
  }

  static async search(query: string): Promise<StreamingService[]> {
    try {
      return await backendSearchMovies(query);
    } catch { /* fallback */ }
    const db = this.getDB();
    const q = query.toLowerCase();
    return db.filter(m => m.name.toLowerCase().includes(q));
  }
}

export const MovieAPI = {
  getAll: AimeFilmsAPI.getMovies.bind(AimeFilmsAPI),
  search: AimeFilmsAPI.search.bind(AimeFilmsAPI),
  getWatchlist: (email: string) => AimeFilmsAPI.fetchWatchlist(email),
  saveWatchlist: (email: string, ids: string[]) => AimeFilmsAPI.syncWatchlist(email, ids),
  addDownloadRecord: (_id: string, _q: string) => { }
};
