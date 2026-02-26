
import React, { useState, useEffect, useMemo } from 'react';
import { AimeFilmsAPI } from '../services/api';
import { StreamingService, User, LogEntry, UserMessage, Brand } from '../types';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const brandColors = {
    aimefilms: { bg: 'bg-red-600', shadow: 'shadow-red-600/20', text: 'text-red-600' },
    filmsnyarwanda: { bg: 'bg-yellow-400', shadow: 'shadow-yellow-400/20', text: 'text-yellow-400' },
    princefilms: { bg: 'bg-purple-600', shadow: 'shadow-purple-600/20', text: 'text-purple-600' }
  };

  const currentBrand = brandColors[brand] || brandColors.aimefilms;

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

  const loadData = async () => {
    setIsLoading(true);
    if (activeTab === 'movies') setMovies(await AimeFilmsAPI.getMovies());
    else if (activeTab === 'users') setUsers(await AimeFilmsAPI.getAllUsers());
    else if (activeTab === 'history') setLogs(await AimeFilmsAPI.getLogs());
    else if (activeTab === 'feedback') setMessages(await AimeFilmsAPI.getAllMessages());
    else if (activeTab === 'analytics') setStats(await AimeFilmsAPI.getIntelligenceData());
    setIsLoading(false);
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    await AimeFilmsAPI.addMovie(newMovie as any);
    setIsAddingMovie(false);
    loadData();
    onRefresh();
  };

  const handleDeleteMovie = async (id: string) => {
    if (confirm('Are you sure you want to delete this film?')) {
      await AimeFilmsAPI.deleteMovie(id);
      loadData();
      onRefresh();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'videoUrl' | 'fullMovieUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMovie(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
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
              onClick={() => {
                const data = {
                  movies: localStorage.getItem('aimefilms_db_v4'),
                  users: localStorage.getItem('aimefilms_users_v3'),
                  analytics: localStorage.getItem('aimefilms_analytics_v1'),
                  inbox: localStorage.getItem('aimefilms_user_inbox_v1')
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aimefilms_backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
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
            </h2>
            {activeTab === 'movies' && (
              <button onClick={() => setIsAddingMovie(true)} className={`bg-white text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:${currentBrand.bg} hover:text-white transition-all`}>
                + Upload New Film
              </button>
            )}
          </header>

          <main className="flex-1 overflow-y-auto p-10 no-scrollbar">
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
                    {movies.map(movie => (
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
                              onClick={() => AimeFilmsAPI.updateMovie(movie.id, { isHidden: !movie.isHidden }).then(() => { loadData(); onRefresh(); })} 
                              className={`p-3 rounded-xl transition-all ${movie.isHidden ? 'bg-yellow-600/20 text-yellow-500' : 'bg-green-600/20 text-green-500'}`}
                              title={movie.isHidden ? "Show Movie" : "Hide Movie"}
                            >
                              {movie.isHidden ? '👁️‍🗨️' : '👁️'}
                            </button>
                            <button onClick={() => handleDeleteMovie(movie.id)} className={`p-3 bg-red-600/10 text-red-500 rounded-xl hover:${currentBrand.bg} hover:text-white transition-all`}>
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
                      {movies.map(movie => (
                        <div key={movie.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/5">
                            <img src={movie.imageUrl} className="w-full h-full object-cover opacity-50" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-white truncate">{movie.name}</p>
                            <p className="text-[8px] font-black uppercase text-gray-500 mt-1">Path: /films/{movie.name.toLowerCase().replace(/\s+/g, '_')}.mp4</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-black/50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                          <th className="px-8 py-6">User</th>
                          <th className="px-8 py-6">Password</th>
                          <th className="px-8 py-6">Status</th>
                          <th className="px-8 py-6">Joined</th>
                          <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                          <tr key={u.email} className="hover:bg-white/[0.02]">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center font-black">{u.name.charAt(0)}</div>
                                <div>
                                  <p className="font-black italic">{u.name}</p>
                                  <p className="text-[10px] text-gray-500">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <code className="text-[10px] bg-white/5 px-2 py-1 rounded font-mono text-yellow-500">{u.password || '••••••'}</code>
                            </td>
                            <td className="px-8 py-6">
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${u.isBlocked ? 'bg-red-600/20 text-red-500' : 'bg-green-600/20 text-green-500'}`}>
                                {u.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-xs text-gray-500 font-mono">
                              {u.joinedAt?.split('T')[0]}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button onClick={() => AimeFilmsAPI.toggleUserBlock(u.email).then(loadData)} className="text-xs font-black uppercase tracking-widest text-red-500 hover:underline">
                                {u.isBlocked ? 'Unblock' : 'Block'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

      {/* Add Movie Modal */}
      {isAddingMovie && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsAddingMovie(false)} />
          <form onSubmit={handleAddMovie} className="relative bg-[#0c0c0c] w-full max-w-2xl p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Upload New Content</h3>
            
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

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Image (Poster)</label>
              <div className="flex gap-4">
                <input value={newMovie.imageUrl} onChange={e => setNewMovie({...newMovie, imageUrl: e.target.value})} placeholder="URL" className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-red-600" />
                <label className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl cursor-pointer transition-all">
                  📁
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e, 'imageUrl')} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Video (Trailer)</label>
              <div className="flex gap-4">
                <input value={newMovie.videoUrl} onChange={e => setNewMovie({...newMovie, videoUrl: e.target.value})} placeholder="URL" className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-red-600" />
                <label className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl cursor-pointer transition-all">
                  📁
                  <input type="file" accept="video/*" className="hidden" onChange={e => handleFileChange(e, 'videoUrl')} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Full Movie</label>
              <div className="flex gap-4">
                <input value={newMovie.fullMovieUrl} onChange={e => setNewMovie({...newMovie, fullMovieUrl: e.target.value})} placeholder="URL" className={`flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')}`} />
                <label className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl cursor-pointer transition-all">
                  📁
                  <input type="file" accept="video/*" className="hidden" onChange={e => handleFileChange(e, 'fullMovieUrl')} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Synopsis</label>
              <textarea required value={newMovie.synopsis} onChange={e => setNewMovie({...newMovie, synopsis: e.target.value})} rows={4} className={`w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-${currentBrand.text.replace('text-', '')} resize-none`} />
            </div>

            <button type="submit" className={`w-full ${currentBrand.bg} text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl ${currentBrand.shadow} hover:scale-[1.02] active:scale-95 transition-all`}>
              Commit to Database
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
