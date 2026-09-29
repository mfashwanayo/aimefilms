import { STREAMING_SERVICES } from '../constants';
import { StreamingService, User, UserPost, UserMessage, LogEntry } from '../types';
import { backendLogin, backendRegister, backendGetMovies, backendSearchMovies, backendTrackView } from './backendApi';
import { apiFetch, getAuthToken, setAuthToken } from './http';

// Compatibility layer: calls the Python REST API via backendApi.ts when possible,
// falls back to localStorage when the backend is unreachable.

export const MASTER_ADMIN_CREDENTIALS = {
  name: 'hybert',
  email: 'hybertmfashwanayo@gmail.com',
  password: '%bert123{}@'
};

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
async function backendAdminToggleBlock(email: string): Promise<any> {
  return apiFetch<any>(`/api/admin/users/${encodeURIComponent(email)}/toggle-block`, { method: 'POST' });
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
    try {
      if (getAuthToken()) {
        const res = await backendAdminGetLogs();
        if (res?.success) return res.logs;
      }
    } catch { /* fallback */ }
    return this.getAnalytics().logs;
  }

  static async clearLogs(): Promise<void> {
    try {
      await backendAdminClearLogs();
      return;
    } catch { /* fallback */ }
    const analytics = this.getAnalytics();
    analytics.logs = [];
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
  }

  // --- MOVIES ADMIN ---
  static async addMovie(movie: Omit<StreamingService, 'id'>): Promise<StreamingService> {
    try {
      const res = await backendAdminAddMovie(movie);
      if (res?.success && res.movie?.id) {
        await this.addLog('UPLOAD', `Uploaded movie: ${movie.name}`);
        return { ...movie, id: res.movie.id } as StreamingService;
      }
    } catch { /* fallback */ }

    const db = this.getDB();
    const newMovie = { ...movie, id: Math.random().toString(36).substr(2, 9) } as StreamingService;
    db.unshift(newMovie);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    await this.addLog('UPLOAD', `Uploaded movie: ${newMovie.name}`);
    return newMovie;
  }

  static async updateMovie(id: string, updates: Partial<StreamingService>): Promise<boolean> {
    try {
      await backendAdminUpdateMovie(id, updates);
      return true;
    } catch { /* fallback */ }
    const db = this.getDB();
    const idx = db.findIndex(m => m.id === id);
    if (idx !== -1) {
      db[idx] = { ...db[idx], ...updates };
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    }
    return false;
  }

  static async deleteMovie(id: string): Promise<boolean> {
    try {
      await backendAdminDeleteMovie(id);
      return true;
    } catch { /* fallback */ }
    const db = this.getDB();
    const filtered = db.filter(m => m.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(filtered));
    return true;
  }

  // --- INTELLIGENCE / ANALYTICS ---
  static async getAllMessages(): Promise<UserMessage[]> {
    try {
      const res = await backendAdminGetAllMessages();
      if (res?.success) return res.messages;
    } catch { /* fallback */ }
    const stored = localStorage.getItem(INBOX_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static async getIntelligenceData() {
    try {
      const res = await backendAdminGetAnalytics();
      if (res?.success && res.analytics) return res.analytics;
    } catch { /* fallback */ }

    await delay(API_LATENCY);
    const analytics = this.getAnalytics();
    const movies = this.getDB();
    const users = this.getUsers();

    const topMovies = Object.entries(analytics.views)
      .map(([id, views]) => {
        const movie = movies.find(m => m.id === id);
        return {
          name: movie?.name || 'Unknown Asset',
          views: views as number,
          id,
          brand: movie?.brand || 'aimefilms',
          rating: movie ? parseFloat(movie.rating) : 0,
          engagement: Math.min(100, (views as number) * 5)
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const brandStats: Record<string, { views: number; movies: number }> = {
      aimefilms: { views: 0, movies: movies.filter(m => m.brand === 'aimefilms').length },
      filmsnyarwanda: { views: 0, movies: movies.filter(m => m.brand === 'filmsnyarwanda').length },
      princefilms: { views: 0, movies: movies.filter(m => m.brand === 'princefilms').length }
    };

    Object.entries(analytics.views).forEach(([id, views]) => {
      const movie = movies.find(m => m.id === id);
      if (movie && brandStats[movie.brand]) {
        brandStats[movie.brand].views += (views as number);
      }
    });

    return {
      topMovies,
      totalViews: Object.values(analytics.views).reduce((a: any, b: any) => a + b, 0),
      newUsers: users.slice(-10),
      recentActivity: analytics.logs.slice(0, 20),
      brandStats
    };
  }

  // --- AUTH ---
  static async authenticateUser(identifier: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const res = await backendLogin(identifier, password);
      if (res.success && res.user) return { success: true, user: res.user };
      return { success: false, message: res.message || 'Identity check failed.' };
    } catch { /* fallback */ }

    await delay(API_LATENCY);
    const idLower = identifier.trim().toLowerCase();
    if ((idLower === MASTER_ADMIN_CREDENTIALS.email.toLowerCase() || idLower === MASTER_ADMIN_CREDENTIALS.name.toLowerCase()) && password === MASTER_ADMIN_CREDENTIALS.password) {
      const adminUser: User = { name: MASTER_ADMIN_CREDENTIALS.name, email: MASTER_ADMIN_CREDENTIALS.email, role: 'admin', isVerified: true, joinedAt: '2024-01-01T' };
      await this.addLog('LOGIN', 'Admin logged in', adminUser.email);
      return { success: true, user: adminUser };
    }
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === idLower || u.name.toLowerCase() === idLower);
    if (!user || user.password !== password) return { success: false, message: 'Identity check failed.' };
    const { password: _, ...sanitized } = user;
    await this.addLog('LOGIN', 'User logged in', sanitized.email);
    return { success: true, user: sanitized as User };
  }

  static async registerUser(userData: Partial<User & { password?: string }>): Promise<{ success: boolean; message: string }> {
    try {
      if (userData.email && userData.password) {
        return await backendRegister(userData.name || '', userData.email, userData.password);
      }
    } catch { /* fallback */ }

    const users = this.getUsers();
    if (users.some(u => u.email.toLowerCase() === userData.email?.toLowerCase())) {
      return { success: false, message: 'Email is already in the registry.' };
    }
    const newUser = { ...userData, role: 'user' as const, isVerified: true, isBlocked: false, joinedAt: new Date().toISOString() };
    this.saveUsers([...users, newUser]);
    await this.addLog('REGISTER', `New user registered: ${newUser.email}`, newUser.email);
    return { success: true, message: 'Success.' };
  }

  private static getUsers(): (User & { password?: string })[] {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private static saveUsers(users: any[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  static async getAllUsers(): Promise<User[]> {
    try {
      const res = await backendAdminGetUsers();
      if (res?.success) return res.users;
    } catch { /* fallback */ }
    return this.getUsers() as User[];
  }

  static async getUserPosts(email: string): Promise<UserPost[]> {
    await delay(API_LATENCY);
    const stored = localStorage.getItem(GALLERY_KEY);
    if (!stored) return [];
    const gallery: UserPost[] = JSON.parse(stored);
    return gallery.filter(p => p.userEmail.toLowerCase() === email.toLowerCase());
  }

  static async updateUserProfile(email: string, updates: { name: string; avatar: string }): Promise<boolean> {
    try {
      await backendUpdateProfile(updates.name, updates.avatar);
      return true;
    } catch { /* fallback */ }
    await delay(API_LATENCY);
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx !== -1) {
      users[idx].name = updates.name;
      users[idx].avatar = updates.avatar;
      this.saveUsers(users);
      return true;
    }
    return false;
  }

  static async toggleUserBlock(email: string): Promise<boolean> {
    try {
      await backendAdminToggleBlock(email);
      return true;
    } catch { /* fallback */ }
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx !== -1) {
      users[idx].isBlocked = !users[idx].isBlocked;
      this.saveUsers(users);
      await this.addLog('BLOCK', `${users[idx].isBlocked ? 'Blocked' : 'Unblocked'} user: ${email}`);
      return true;
    }
    return false;
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
