
import React, { useState, useEffect, useMemo } from 'react';
import { AimeFilmsAPI } from '../services/api';
import { backendUploadVideo } from '../services/backendApi';
import { StreamingService, User, LogEntry, UserMessage, Brand, Language } from '../types';
import Logo from './Logo';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  brand: Brand;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, onRefresh, brand }) => {
  const [activeTab, setActiveTab] = useState<'movies' | 'users' | 'history' | 'feedback' | 'analytics' | 'media'>('analytics');
  const [movies, setMovies] = useState<StreamingService[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userEditForm, setUserEditForm] = useState<{ name: string; avatar: string; language: Language; isVerified: boolean; canDownload: boolean }>({
    name: '', avatar: '', language: 'EN', isVerified: true, canDownload: true
  });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<Partial<Record<'videoUrl' | 'fullMovieUrl', File>>>({});
  const [videoProgress, setVideoProgress] = useState<Partial<Record<'videoUrl' | 'fullMovieUrl', number>>>({});
  const [uploadStatus, setUploadStatus] = useState('');
  const [isSavingMovie, setIsSavingMovie] = useState(false);
  const [pendingVideoMovieId, setPendingVideoMovieId] = useState<string | null>(null);
  const [uploadedVideoFields, setUploadedVideoFields] = useState<string[]>([]);
  
  const brandColors = {
    aimefilms: { bg: 'bg-red-600', shadow: 'shadow-red-600/20', text: 'text-red-600' },
    filmsnyarwanda: { bg: 'bg-yellow-400', shadow: 'shadow-yellow-400/20', text: 'text-yellow-400' },
    princefilms: { bg: 'bg-purple-600', shadow: 'shadow-purple-600/20', text: 'text-purple-600' }
  };

  const currentBrand = brandColors[brand] || brandColors.aimefilms;
  // Default to the website from which the admin dashboard was opened, while
  // still allowing administrators to manage any movie across all three sites.
  const [catalogueFilter, setCatalogueFilter] = useState<Brand | 'all'>(brand);
  const filteredMovies = useMemo(
    () => catalogueFilter === 'all' ? movies : movies.filter(movie => movie.brand === catalogueFilter),
    [movies, catalogueFilter]
  );

  useEffect(() => {
    setCatalogueFilter(brand);
  }, [brand]);

  // Movie Form State
  const [isAddingMovie, setIsAddingMovie] = useState(false);
  const [newMovie, setNewMovie] = useState<Partial<StreamingService>>({
    name: '',
    brand: 'aimefilms',
    section: 'kinyarwanda',
    category: 'General Entertainment',
    description: '',
    imageUrl: '',
    videoUrl: '',
    fullMovieUrl: '',
    rating: '8.0',
    year: '2024',
    duration: '1h 30m',
    genre: ['Action'],
    highlights: [],
    pros: [],
    cast: [],
    synopsis: '',
    matchScore: 90
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'users') return;
    let active = true;
    const refreshUsersSilently = async () => {
      try {
        const latestUsers = await AimeFilmsAPI.getAllUsers();
        if (active) setUsers(latestUsers);
      } catch {
        // Keep the last successful list visible if a periodic refresh has a network issue.
      }
    };
    const interval = window.setInterval(refreshUsersSilently, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    setAdminError('');
    try {
      if (activeTab === 'movies' || activeTab === 'media') setMovies(await AimeFilmsAPI.getAdminMovies());
      else if (activeTab === 'users') setUsers(await AimeFilmsAPI.getAllUsers());
      else if (activeTab === 'history') setLogs(await AimeFilmsAPI.getLogs());
      else if (activeTab === 'feedback') setMessages(await AimeFilmsAPI.getAllMessages());
      else if (activeTab === 'analytics') setStats(await AimeFilmsAPI.getIntelligenceData());
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not load data from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewMovie = () => {
    setEditingMovieId(null);
    setSelectedVideoFiles({});
    setVideoProgress({});
    setUploadedVideoFields([]);
    setPendingVideoMovieId(null);
    setUploadStatus('');
    setNewMovie({
      name: '',
      brand,
      section: 'kinyarwanda',
      category: 'General Entertainment',
      description: '',
      imageUrl: '',
      videoUrl: '',
      fullMovieUrl: '',
      rating: '8.0',
      year: String(new Date().getFullYear()),
      duration: '1h 30m',
      genre: ['Action'],
      highlights: [],
      pros: [],
      cast: [],
      synopsis: '',
      isTrending: false,
      isNew: true,
      isHidden: false,
      matchScore: 90
    });
    setIsAddingMovie(true);
  };

  const handleEditMovie = (movie: StreamingService) => {
    setEditingMovieId(movie.id);
    setPendingVideoMovieId(null);
    setSelectedVideoFiles({});
    setVideoProgress({});
    setUploadedVideoFields([]);
    setUploadStatus('');
    setNewMovie({
      ...movie,
      genre: [...(movie.genre || [])],
      cast: [...(movie.cast || [])],
      highlights: [...(movie.highlights || [])],
      pros: [...(movie.pros || [])]
    });
    setIsAddingMovie(true);
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMovie(true);
    setUploadStatus('');
    setAdminError('');
    try {
      const videoEntries = (Object.entries(selectedVideoFiles) as Array<['videoUrl' | 'fullMovieUrl', File]>)
        .filter(([, file]) => Boolean(file));
      let movieId = editingMovieId || pendingVideoMovieId;

      if (editingMovieId) {
        // Leave prior URLs in the database until the replacement upload is verified.
        const metadata: Partial<StreamingService> = { ...newMovie };
        if (selectedVideoFiles.videoUrl) delete metadata.videoUrl;
        if (selectedVideoFiles.fullMovieUrl) delete metadata.fullMovieUrl;
        await AimeFilmsAPI.updateMovie(editingMovieId, metadata);
      } else if (videoEntries.length === 0) {
        await AimeFilmsAPI.addMovie(newMovie as any);
      } else if (!movieId) {
        const metadata: Partial<StreamingService> = {
          ...newMovie,
          ...(selectedVideoFiles.videoUrl ? { videoUrl: '' } : {}),
          ...(selectedVideoFiles.fullMovieUrl ? { fullMovieUrl: '' } : {})
        };
        const created = await AimeFilmsAPI.addMovie(metadata as any);
        movieId = created.id;
        setPendingVideoMovieId(movieId);
      }

      if (videoEntries.length > 0 && movieId) {
        const completed = new Set(uploadedVideoFields);
        for (const [field, file] of videoEntries) {
          if (completed.has(field)) continue;
          setUploadStatus(`Uploading ${file.name} to Supabase Storage…`);
          setVideoProgress(prev => ({ ...prev, [field]: 0 }));
          await backendUploadVideo(file, movieId!, field, percent => {
            setVideoProgress(prev => ({ ...prev, [field]: percent }));
          });
          completed.add(field);
          setUploadedVideoFields(Array.from(completed));
          setUploadStatus(`Saved ${field === 'fullMovieUrl' ? 'full movie' : 'trailer'} to Storage and database.`);
        }
      }

      setUploadStatus(editingMovieId ? 'Film changes saved to the database.' : 'Film saved successfully.');
      setIsAddingMovie(false);
      setEditingMovieId(null);
      setSelectedVideoFiles({});
      setVideoProgress({});
      setPendingVideoMovieId(null);
      setUploadedVideoFields([]);
      await loadData();
      onRefresh();
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : 'Film changes failed.');
    } finally {
      setIsSavingMovie(false);
    }
  };

  const handleDeleteMovie = async (movie: StreamingService) => {
    if (!confirm(`Delete "${movie.name}" from the database and remove its managed video files?`)) return;
    setAdminError('');
    try {
      await AimeFilmsAPI.deleteMovie(movie.id);
      await loadData();
      onRefresh();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'The film could not be deleted.');
    }
  };

  const handleToggleMovieVisibility = async (movie: StreamingService) => {
    setAdminError('');
    try {
      await AimeFilmsAPI.updateMovie(movie.id, { isHidden: !movie.isHidden });
      await loadData();
      onRefresh();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'The visibility change failed.');
    }
  };

  const handleEditUser = (account: User) => {
    setEditingUser(account);
    setUserEditForm({
      name: account.name || '',
      avatar: account.avatar || '',
      language: account.language || 'EN',
      isVerified: account.isVerified ?? false,
      canDownload: account.canDownload ?? true,
    });
    setAdminError('');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    setAdminError('');
    try {
      await AimeFilmsAPI.updateManagedUser(editingUser.email, userEditForm);
      setEditingUser(null);
      await loadData();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'The account changes could not be saved.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserFlag = async (email: string, field: 'isVerified' | 'canDownload', currentValue: boolean) => {
    setAdminError('');
    try {
      const updates: Partial<Pick<User, 'isVerified' | 'canDownload'>> = {};
      updates[field] = !currentValue;
      await AimeFilmsAPI.updateManagedUser(email, updates);
      await loadData();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'The account setting could not be updated.');
    }
  };

  const handleToggleUserBlock = async (email: string) => {
    setAdminError('');
    try {
      await AimeFilmsAPI.toggleUserBlock(email);
      await loadData();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'The user status could not be changed.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMovie(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'videoUrl' | 'fullMovieUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExtensions = /\\.(mp4|webm|mov|mkv)$/i;
    if (!allowedExtensions.test(file.name)) {
      setUploadStatus('Choose an MP4, WebM, MOV, or MKV video.');
      e.target.value = '';
      return;
    }
    if (file.size > 3_900_000_000) {
      setUploadStatus('This video is larger than the app limit of 3.9 GB.');
      e.target.value = '';
      return;
    }
    setSelectedVideoFiles(prev => ({ ...prev, [field]: file }));
    setNewMovie(prev => ({ ...prev, [field]: '' }));
    setUploadedVideoFields(prev => prev.filter(uploadedField => uploadedField !== field));
    setVideoProgress(prev => ({ ...prev, [field]: 0 }));
    setUploadStatus('');
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-[#050505] text-white flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* Sidebar-style Header */}
      <div className="flex h-full">
        <div className="w-64 bg-black border-r border-white/10 flex flex-col p-6 gap-8">
          <div className="flex items-center gap-3 px-2">
            <Logo size="sm" brand="aimefilms" />
          </div>

          <nav className="flex flex-col gap-2">
            {[
              { id: 'analytics', label: 'Insights', icon: '📊' },
              { id: 'movies', label: 'Film Inventory', icon: '🎬' },
              { id: 'media', label: 'Media Library', icon: '📁' },
              { id: 'users', label: 'User Registry', icon: '👥' },
              { id: 'history', label: 'Event Logs', icon: '📜' },
              { id: 'feedback', label: 'Feedback', icon: '💬', badge: messages.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id ? `${currentBrand.bg} text-white shadow-lg ${currentBrand.shadow}` : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
              >
                <div className="flex items-center gap-3">
                  <span>{tab.icon}</span>
                  {tab.label}
                </div>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`bg-white ${currentBrand.text} px-2 py-0.5 rounded-full text-[10px] font-black`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-2">
            <button 
              onClick={async () => {
                setAdminError('');
                try {
                  const [databaseMovies, databaseUsers, databaseLogs, databaseMessages, databaseAnalytics] = await Promise.all([
                    AimeFilmsAPI.getAdminMovies(),
                    AimeFilmsAPI.getAllUsers(),
                    AimeFilmsAPI.getLogs(),
                    AimeFilmsAPI.getAllMessages(),
                    AimeFilmsAPI.getIntelligenceData(),
                  ]);
                  const data = {
                    exportedAt: new Date().toISOString(),
                    movies: databaseMovies,
                    users: databaseUsers.map(account => ({
                      name: account.name, email: account.email, role: account.role,
                      isVerified: account.isVerified, canDownload: account.canDownload,
                      isBlocked: account.isBlocked, joinedAt: account.joinedAt
                    })),
                    logs: databaseLogs,
                    messages: databaseMessages,
                    analytics: databaseAnalytics,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `aimefilms_database_backup_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  setAdminError(error instanceof Error ? error.message : 'Database export failed.');
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-blue-400 hover:bg-blue-400/10 transition-all"
            >
              <span>💾</span> Export Data
            </button>
            <button onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-500 hover:bg-red-500/10 transition-all">
              <span>🚪</span> Exit Backend
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-20 border-b border-white/10 flex items-center justify-between px-10 bg-black/50 backdrop-blur-md">
            <h2 className="text-2xl font-black uppercase tracking-tight italic">
              {activeTab === 'analytics' && 'System Insights'}
              {activeTab === 'movies' && 'Manage Films'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'history' && 'System History'}
              {activeTab === 'feedback' && 'User Feedback'}
              {activeTab === 'media' && 'Media Library'}
            </h2>
            {(activeTab === 'movies' || activeTab === 'media') && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <label htmlFor="admin-brand-filter" className="sr-only">Filter movie catalogue by website</label>
                <select
                  id="admin-brand-filter"
                  value={catalogueFilter}
                  onChange={e => setCatalogueFilter(e.target.value as Brand | 'all')}
                  className="max-w-[220px] rounded-xl border border-white/10 bg-[#151515] px-4 py-2 text-xs font-bold text-white outline-none focus:border-violet-400"
                >
                  <option value="aimefilms">AimeFilms films</option>
                  <option value="filmsnyarwanda">FilmsNyarwanda films</option>
                  <option value="princefilms">PrinceFilms films</option>
                  <option value="all">All websites — all films</option>
                </select>
                {activeTab === 'movies' && (
                  <button onClick={handleStartNewMovie} className={`bg-white text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:${currentBrand.bg} hover:text-white transition-all`}>
                    + Upload New Film
                  </button>
                )}
              </div>
            )}
          </header>

          <main className="flex-1 overflow-y-auto p-10 no-scrollbar">
            {adminError && (
              <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
                <span>{adminError}</span>
                <button type="button" onClick={() => setAdminError('')} aria-label="Dismiss error" className="font-black text-red-100">×</button>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className={`w-10 h-10 border-4 border-${currentBrand.text.replace('text-', '')} border-t-transparent rounded-full animate-spin`} />
              </div>
            ) : (
              <>
                {activeTab === 'analytics' && stats && (
                  <div className="space-y-10">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">AimeFilms</p>
                          <span className="text-red-500 font-bold text-xs">{stats.brandStats.aimefilms.movies} Assets</span>
                        </div>
                        <p className="text-4xl font-black italic text-red-600">{stats.brandStats.aimefilms.views} Views</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">FilmsNyarwanda</p>
                          <span className="text-blue-500 font-bold text-xs">{stats.brandStats.filmsnyarwanda.movies} Assets</span>
                        </div>
                        <p className="text-4xl font-black italic text-blue-500">{stats.brandStats.filmsnyarwanda.views} Views</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">PrinceFilms</p>
                          <span className="text-purple-500 font-bold text-xs">{stats.brandStats.princefilms.movies} Assets</span>
                        </div>
                        <p className="text-4xl font-black italic text-purple-500">{stats.brandStats.princefilms.views} Views</p>
                      </div>
                    </div>

                    {/* Most Viewed Films */}
                    <div className="space-y-6">
                      <h3 className="text-xl font-black uppercase italic tracking-tight">Most Viewed Content (Zarebwe Cyane)</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {stats.topMovies.map((movie: any, idx: number) => (
                          <div key={movie.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                            <div className="flex items-center gap-6">
                              <div className={`w-10 h-10 bg-black rounded-lg flex items-center justify-center font-black ${currentBrand.text} border border-${currentBrand.text.replace('text-', '')}/30`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-black italic text-lg">{movie.name}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Rating: {movie.rating} • Engagement: {movie.engagement}%</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black italic text-white">{movie.views}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">Total Views</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity Summary */}
                    <div className="space-y-6">
                      <h3 className="text-xl font-black uppercase italic tracking-tight">Recent System Pulses</h3>
                      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">
                        {stats.recentActivity.slice(0, 5).map((log: any) => (
                          <div key={log.id} className="border-b border-white/5 p-6 flex items-center justify-between last:border-0">
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full">{log.type}</span>
                              <p className="text-sm font-medium text-gray-300">{log.details || log.movieId}</p>
                            </div>
                            <span className="text-[10px] font-mono text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'movies' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMovies.length === 0 && (
                      <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                        <p className="font-bold text-white">
                          {catalogueFilter === 'all' ? 'No films are stored in the database yet.' : `No films found for ${catalogueFilter === 'filmsnyarwanda' ? 'FilmsNyarwanda' : catalogueFilter === 'princefilms' ? 'PrinceFilms' : 'AimeFilms'}.`}
                        </p>
                        <p className="mt-2 text-sm text-gray-400">Choose another website filter, or upload a film to create its database record.</p>
                      </div>
                    )}
                    {filteredMovies.map(movie => (
                      <div key={movie.id} className={`bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-${currentBrand.text.replace('text-', '')}/50 transition-all`}>
                        <div className="aspect-video relative">
                          <img src={movie.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                          <div className="absolute top-4 left-4 flex gap-2">
                            <div className="bg-black/80 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                              {movie.section}
                            </div>
                            <div className={`bg-black/80 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 ${movie.brand === 'filmsnyarwanda' ? 'text-blue-500' : movie.brand === 'princefilms' ? 'text-purple-500' : 'text-red-500'}`}>
                              {movie.brand}
                            </div>
                          </div>
                        </div>
                        <div className="p-6 flex justify-between items-center">
                          <div>
                            <h3 className="font-black text-lg italic">{movie.name}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase">{movie.year} • {movie.duration}</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleToggleMovieVisibility(movie)} 
                              className={`p-3 rounded-xl transition-all ${movie.isHidden ? 'bg-yellow-600/20 text-yellow-500' : 'bg-green-600/20 text-green-500'}`}
                              title={movie.isHidden ? "Show Movie" : "Hide Movie"}
                            >
                              {movie.isHidden ? '👁️‍🗨️' : '👁️'}
                            </button>
                            <button type="button" onClick={() => handleEditMovie(movie)} title="Edit film details" className="p-3 rounded-xl bg-violet-600/10 text-violet-300 hover:bg-violet-600 hover:text-white transition-all">
                              ✏️
                            </button>
                            <button type="button" onClick={() => handleDeleteMovie(movie)} title="Delete film and its managed video files" className={`p-3 bg-red-600/10 text-red-500 rounded-xl hover:${currentBrand.bg} hover:text-white transition-all`}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'media' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Media Repository (/films)</h3>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">All uploaded assets are stored in the system core.</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {filteredMovies.map(movie => {
                        const mediaUrl = movie.fullMovieUrl || movie.videoUrl;
                        const storagePath = mediaUrl?.includes('/aimefilms-videos/')
                          ? mediaUrl.split('/aimefilms-videos/').pop()
                          : mediaUrl;
                        return (
                        <div key={movie.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/5">
                            <img src={movie.imageUrl} className="w-full h-full object-cover opacity-50" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-white truncate">{movie.name}</p>
                            <p className="text-[8px] font-black uppercase text-gray-500 mt-1 break-all">Storage: {storagePath || 'No uploaded video'}</p>
                            {mediaUrl && <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-green-400 underline">Open video</a>}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-white">Registered accounts</p>
                        <p className="mt-1 text-xs text-gray-500">{users.length} account(s) from the database. Passwords are never displayed.</p>
                      </div>
                      <button type="button" onClick={loadData} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/10">Refresh list</button>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-x-auto">
                    <table className="w-full text-left min-w-[980px]">
                      <thead>
                        <tr className="bg-black/50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                          <th className="px-6 py-5">User</th>
                          <th className="px-6 py-5">Account details</th>
                          <th className="px-6 py-5">Status</th>
                          <th className="px-6 py-5">Joined</th>
                          <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No accounts have registered in this database yet.</td></tr>
                        )}
                        {users.map(u => (
                          <tr key={u.email} className="hover:bg-white/[0.02]">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 overflow-hidden flex items-center justify-center font-black">
                                   {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                                 </div>
                                <div>
                                  <p className="font-black italic">{u.name}</p>
                                  <p className="text-[10px] text-gray-500">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="space-y-1 text-[10px] text-gray-400">
                                <p>Role: <span className="font-bold text-white">{u.role === 'admin' ? 'Administrator' : 'User'}</span></p>
                                <p>Verified: <span className="font-bold text-white">{u.isVerified ? 'Yes' : 'No'}</span></p>
                                <p>Downloads: <span className="font-bold text-white">{u.canDownload ? 'Allowed' : 'Disabled'}</span></p>
                                 <p>Language: <span className="font-bold text-white">{u.language || 'EN'}</span></p>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${u.isBlocked ? 'bg-red-600/20 text-red-300' : 'bg-green-600/20 text-green-300'}`}>
                                {u.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-xs text-gray-500 font-mono">
                              {u.joinedAt?.split('T')[0]}
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col items-end gap-2">
                                 <button type="button" onClick={() => handleEditUser(u)} disabled={u.role === 'admin'} className="text-[10px] font-black uppercase tracking-widest text-violet-300 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed">Edit account</button>
                                 <button type="button" disabled={u.role === 'admin'} onClick={() => handleToggleUserFlag(u.email, 'isVerified', Boolean(u.isVerified))} className={`text-[10px] font-black uppercase tracking-widest hover:underline disabled:text-gray-600 disabled:cursor-not-allowed ${u.isVerified ? 'text-amber-300' : 'text-green-300'}`}>{u.isVerified ? 'Unverify' : 'Verify'}</button>
                                 <button type="button" disabled={u.role === 'admin'} onClick={() => handleToggleUserFlag(u.email, 'canDownload', Boolean(u.canDownload))} className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:underline disabled:text-gray-600 disabled:cursor-not-allowed">{u.canDownload ? 'Disable downloads' : 'Enable downloads'}</button>
                                 <button type="button" disabled={u.role === 'admin'} title={u.role === 'admin' ? 'Administrator accounts are protected' : ''} onClick={() => handleToggleUserBlock(u.email)} className={`text-[10px] font-black uppercase tracking-widest hover:underline disabled:cursor-not-allowed disabled:text-gray-600 ${u.isBlocked ? 'text-green-400' : 'text-red-400'}`}>{u.role === 'admin' ? 'Admin protected' : u.isBlocked ? 'Unblock user' : 'Block user'}</button>
                               </div>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">System Event Logs</h3>
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to clear all system history?')) {
                            AimeFilmsAPI.clearLogs().then(loadData);
                          }
                        }}
                        className={`px-6 py-2 bg-${currentBrand.text.replace('text-', '')}/10 ${currentBrand.text} border border-${currentBrand.text.replace('text-', '')}/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:${currentBrand.bg} hover:text-white transition-all`}
                      >
                        Clear All History
                      </button>
                    </div>
                    <div className="space-y-4">
                      {logs.map(log => (
                      <div key={log.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                        <div className="flex items-center gap-6">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                            log.type === 'VIEW' ? 'bg-blue-600/20 text-blue-500' :
                            log.type === 'LOGIN' ? 'bg-green-600/20 text-green-500' :
                            log.type === 'UPLOAD' ? 'bg-purple-600/20 text-purple-500' :
                            'bg-red-600/20 text-red-500'
                          }`}>
                            {log.type === 'VIEW' ? '👁️' : log.type === 'LOGIN' ? '🔑' : log.type === 'UPLOAD' ? '⬆️' : '⚠️'}
                          </div>
                          <div>
                            <p className="font-black italic text-lg">{log.details}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">{log.userEmail || 'System'} • {new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                          ID: {log.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                {activeTab === 'feedback' && (
                  <div className="grid grid-cols-1 gap-6">
                    {messages.map(msg => (
                      <div key={msg.id} className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-black italic text-red-500">{msg.subject}</h3>
                            <p className="text-sm font-bold text-gray-400">From: {msg.fromName}</p>
                          </div>
                          <span className="text-[10px] font-mono text-gray-600">{new Date(msg.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed font-medium">{msg.body}</p>
                      </div>
                    ))}
                    {messages.length === 0 && <div className="text-center py-20 text-gray-500 font-black uppercase tracking-widest">No feedback received yet</div>}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Add/Edit Movie Modal */}
      {isAddingMovie && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => { if (!isSavingMovie) setIsAddingMovie(false); }} />
          <form onSubmit={handleAddMovie} className="relative bg-[#0c0c0c] w-full max-w-2xl p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">{editingMovieId ? 'Edit Film Details' : 'Upload New Content'}</h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{editingMovieId ? 'Changes are saved to the database; replacement video files are attached after upload completes.' : 'Film details are saved to the database before large video uploads begin.'}</p>
              </div>
              <button type="button" onClick={() => { if (!isSavingMovie) { setIsAddingMovie(false); setEditingMovieId(null); } }} aria-label="Close film editor" className="text-xl text-gray-400 hover:text-white">×</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Film Title</label>
                <input required value={newMovie.name} onChange={e => setNewMovie({...newMovie, name: e.target.value})} className={`w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')}`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Network Brand</label>
                <select value={newMovie.brand} onChange={e => setNewMovie({...newMovie, brand: e.target.value as any})} className={`w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')}`}>
                  <option value="aimefilms">AimeFilms</option>
                  <option value="filmsnyarwanda">FilmsNyarwanda</option>
                  <option value="princefilms">PrinceFilms</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Section</label>
                <select value={newMovie.section} onChange={e => setNewMovie({...newMovie, section: e.target.value as any})} className={`w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')}`}>
                  <option value="kinyarwanda">Films in Kinyarwanda</option>
                  <option value="rwanda">Films in Rwanda</option>
                  <option value="english">Films in English</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Category</label>
                <input required value={newMovie.category} onChange={e => setNewMovie({...newMovie, category: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-red-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Release year</label>
                <input value={newMovie.year || ''} onChange={e => setNewMovie({...newMovie, year: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Duration</label>
                <input value={newMovie.duration || ''} onChange={e => setNewMovie({...newMovie, duration: e.target.value})} placeholder="1h 30m" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Rating</label>
                <input value={newMovie.rating || ''} onChange={e => setNewMovie({...newMovie, rating: e.target.value})} placeholder="8.0" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Short description</label>
              <textarea value={newMovie.description || ''} onChange={e => setNewMovie({...newMovie, description: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500 resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Genres (comma separated)</label>
                <input value={(newMovie.genre || []).join(', ')} onChange={e => setNewMovie({...newMovie, genre: e.target.value.split(',').map(value => value.trim()).filter(Boolean)})} placeholder="Action, Drama" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Cast (comma separated)</label>
                <input value={(newMovie.cast || []).join(', ')} onChange={e => setNewMovie({...newMovie, cast: e.target.value.split(',').map(value => value.trim()).filter(Boolean)})} placeholder="Actor 1, Actor 2" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-xs font-bold text-gray-300">
                <input type="checkbox" checked={Boolean(newMovie.isTrending)} onChange={e => setNewMovie({...newMovie, isTrending: e.target.checked})} className="h-4 w-4 accent-purple-500" />
                Mark as trending
              </label>
              <label className="flex items-center gap-3 text-xs font-bold text-gray-300">
                <input type="checkbox" checked={Boolean(newMovie.isNew)} onChange={e => setNewMovie({...newMovie, isNew: e.target.checked})} className="h-4 w-4 accent-purple-500" />
                Mark as new arrival
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Image (Poster)</label>
              <div className="flex gap-4">
                <input value={newMovie.imageUrl || ''} onChange={e => setNewMovie({...newMovie, imageUrl: e.target.value})} placeholder="Poster URL or choose a local image" className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-red-600" />
                <label className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl cursor-pointer transition-all">
                  📁
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e, 'imageUrl')} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Video (Trailer)</label>
              <div className="flex gap-4">
                <input
                  value={newMovie.videoUrl}
                  onChange={e => setNewMovie({...newMovie, videoUrl: e.target.value})}
                  placeholder="Paste trailer URL or choose a video file below"
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-red-600"
                  disabled={Boolean(selectedVideoFiles.videoUrl)}
                />
                <label className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-2xl cursor-pointer transition-all whitespace-nowrap">
                  📁 Choose video
                  <input
                    type="file"
                    accept=".mp4,.webm,.mov,.mkv,video/mp4,video/webm,video/quicktime,video/x-matroska"
                    className="hidden"
                    onChange={e => handleVideoFileChange(e, 'videoUrl')}
                  />
                </label>
              </div>
              {selectedVideoFiles.videoUrl && (
                <p className="text-xs text-green-400">{selectedVideoFiles.videoUrl.name} · {formatFileSize(selectedVideoFiles.videoUrl.size)}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Full Movie</label>
              <div className="flex gap-4">
                <input
                  value={newMovie.fullMovieUrl}
                  onChange={e => setNewMovie({...newMovie, fullMovieUrl: e.target.value})}
                  placeholder="Paste full movie URL or choose a video file below"
                  className={`flex-1 min-w-0 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')}`}
                  disabled={Boolean(selectedVideoFiles.fullMovieUrl)}
                />
                <label className="bg-white/10 hover:bg-white/20 px-4 py-3 rounded-2xl cursor-pointer transition-all whitespace-nowrap">
                  📁 Choose video
                  <input
                    type="file"
                    accept=".mp4,.webm,.mov,.mkv,video/mp4,video/webm,video/quicktime,video/x-matroska"
                    className="hidden"
                    onChange={e => handleVideoFileChange(e, 'fullMovieUrl')}
                  />
                </label>
              </div>
              {selectedVideoFiles.fullMovieUrl && (
                <p className="text-xs text-green-400">{selectedVideoFiles.fullMovieUrl.name} · {formatFileSize(selectedVideoFiles.fullMovieUrl.size)}</p>
              )}
            </div>

            {Object.entries(selectedVideoFiles).filter(([, file]) => Boolean(file)).map(([field, file]) => (
              <div key={field} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <div className="flex justify-between gap-4 text-xs">
                  <span className="font-bold truncate">{file?.name}</span>
                  <span className="text-gray-400 whitespace-nowrap">{videoProgress[field as 'videoUrl' | 'fullMovieUrl'] ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-[width] duration-200"
                    style={{ width: `${videoProgress[field as 'videoUrl' | 'fullMovieUrl'] ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
            {uploadStatus && (
              <div className={`rounded-xl px-4 py-3 text-sm border ${uploadStatus.toLowerCase().includes('failed') || uploadStatus.toLowerCase().includes('could not') || uploadStatus.toLowerCase().includes('unavailable') || uploadStatus.toLowerCase().includes('error') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                {uploadStatus}
                {uploadStatus.toLowerCase().includes('3.9 gb') && (
                  <p className="mt-2 text-xs">Note: Supabase Free projects have a separate 50 MB maximum. Videos near 3.9 GB require a paid Supabase plan and a higher global Storage file-size limit.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Website / watch link</label>
                <input value={newMovie.link || ''} onChange={e => setNewMovie({ ...newMovie, link: e.target.value })} placeholder="https://..." className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Studio / logo image URL</label>
                <input value={newMovie.logoUrl || ''} onChange={e => setNewMovie({ ...newMovie, logoUrl: e.target.value })} placeholder="https://..." className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Highlights (comma separated)</label>
                <input value={(newMovie.highlights || []).join(', ')} onChange={e => setNewMovie({ ...newMovie, highlights: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="4K, Subtitles, New release" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Features / pros (comma separated)</label>
                <input value={(newMovie.pros || []).join(', ')} onChange={e => setNewMovie({ ...newMovie, pros: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="HD, English subtitles" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Price / access note</label>
                <input value={newMovie.price || ''} onChange={e => setNewMovie({ ...newMovie, price: e.target.value })} placeholder="Free, subscription, etc." className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Recommendation match score (0–100)</label>
                <input type="number" min="0" max="100" value={newMovie.matchScore ?? 0} onChange={e => setNewMovie({ ...newMovie, matchScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-purple-500" />
              </div>
            </div>

            <label className="flex items-center gap-3 text-xs font-bold text-gray-300">
              <input type="checkbox" checked={Boolean(newMovie.isHidden)} onChange={e => setNewMovie({ ...newMovie, isHidden: e.target.checked })} className="h-4 w-4 accent-purple-500" />
              Hide this film from the public catalogue
            </label>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Synopsis</label>
              <textarea required value={newMovie.synopsis || ''} onChange={e => setNewMovie({...newMovie, synopsis: e.target.value})} rows={4} className={`w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')} resize-none`} />
            </div>

            <button type="submit" disabled={isSavingMovie} className={`w-full ${currentBrand.bg} text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl ${currentBrand.shadow} hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait`}>
              {isSavingMovie ? 'Saving / Uploading…' : editingMovieId ? 'Save Film Changes' : 'Commit to Database'}
            </button>
          </form>
        </div>
      )}
      {editingUser && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 md:p-8" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
          <button type="button" aria-label="Close account editor" disabled={isSavingUser} onClick={() => setEditingUser(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <form onSubmit={handleSaveUser} className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#101014] p-6 md:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-300">User Registry</p>
                <h3 id="edit-user-title" className="mt-2 text-2xl font-black text-white">Edit account</h3>
                <p className="mt-1 text-xs text-gray-400 break-all">{editingUser.email}</p>
              </div>
              <button type="button" disabled={isSavingUser} onClick={() => setEditingUser(null)} className="text-2xl leading-none text-gray-400 hover:text-white disabled:opacity-50">×</button>
            </div>
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-gray-400">
              Account changes are saved to the database after you press Save. Email, password and administrator role are protected; passwords and password hashes are never displayed.
            </p>
            <div className="space-y-2">
              <label htmlFor="admin-user-name" className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Display name</label>
              <input id="admin-user-name" required maxLength={120} value={userEditForm.name} onChange={e => setUserEditForm({ ...userEditForm, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-violet-400" />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-user-avatar" className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Avatar image URL or data image (optional)</label>
              <input id="admin-user-avatar" type="text" maxLength={2000000} value={userEditForm.avatar} onChange={e => setUserEditForm({ ...userEditForm, avatar: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-violet-400" />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-user-language" className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Preferred language</label>
              <select id="admin-user-language" value={userEditForm.language} onChange={e => setUserEditForm({ ...userEditForm, language: e.target.value as Language })} className="w-full rounded-xl border border-white/10 bg-[#191820] px-4 py-3 text-white outline-none focus:border-violet-400">
                <option value="EN">English</option><option value="RW">Kinyarwanda</option><option value="FR">Français</option><option value="SW">Kiswahili</option><option value="ZH">中文</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-200">
                <input type="checkbox" checked={userEditForm.isVerified} onChange={e => setUserEditForm({ ...userEditForm, isVerified: e.target.checked })} className="accent-violet-500" /> Verified account
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-200">
                <input type="checkbox" checked={userEditForm.canDownload} onChange={e => setUserEditForm({ ...userEditForm, canDownload: e.target.checked })} className="accent-violet-500" /> Allow downloads
              </label>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button type="button" disabled={isSavingUser} onClick={() => setEditingUser(null)} className="flex-1 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={isSavingUser} className="flex-1 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-50">{isSavingUser ? 'Saving to database…' : 'Save account changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
