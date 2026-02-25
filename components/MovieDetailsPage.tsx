
import React, { useState, useEffect } from 'react';
import { StreamingService, User, Language } from '../types';
import { STREAMING_SERVICES } from '../constants';
import DownloadModal from './DownloadModal';
import { translations } from '../locales/translations';

interface MovieDetailsPageProps {
  movie: StreamingService | null;
  user: User | null; 
  onBack: () => void;
  onPlay: (service: StreamingService, isFull?: boolean) => void;
  onToggleWatchlist: (service: StreamingService) => void;
  isInWatchlist: (id: string) => boolean;
  onSelectRelated: (movie: StreamingService) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  language: Language;
}

const MovieDetailsPage: React.FC<MovieDetailsPageProps> = ({ 
  movie, 
  user,
  onBack, 
  onPlay, 
  onToggleWatchlist, 
  isInWatchlist,
  onSelectRelated,
  onOpenAuth,
  language
}) => {
  const [showDownloadConfig, setShowDownloadConfig] = useState(false);
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  const t = translations[language].details;

  useEffect(() => {
    if (movie) {
      const stored = JSON.parse(localStorage.getItem(`aimefilms_comments_${movie.id}`) || '[]');
      const defaultComments = [
        { id: 1, user: 'CinemaLover', text: 'This movie exceeded all my expectations! The visuals are stunning.', rating: 5, date: '2 days ago' },
        { id: 2, user: 'JohnDoe', text: 'Great story summary, the actual movie is even better. Highly recommend.', rating: 4, date: '1 week ago' },
      ];
      setComments([...stored, ...defaultComments]);
    }
  }, [movie]);

  if (!movie) return null;

  const inList = isInWatchlist(movie.id);
  const related = STREAMING_SERVICES.filter(s => s.id !== movie.id).slice(0, 4);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const newComment = {
      id: Date.now(),
      user: user?.name || 'Anonymous',
      text: comment,
      rating: 5,
      date: 'Just now'
    };
    
    // Save to persistence
    const current = JSON.parse(localStorage.getItem(`aimefilms_comments_${movie.id}`) || '[]');
    localStorage.setItem(`aimefilms_comments_${movie.id}`, JSON.stringify([newComment, ...current]));
    
    setComments([newComment, ...comments]);
    setComment('');
  };

  const handleDownloadClick = () => {
    if (!user) { onOpenAuth('signup'); return; }
    if (user.canDownload || user.role === 'admin' || user.isVerified) setShowDownloadConfig(true);
    else setShowPermissionError(true);
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#000000] animate-in fade-in duration-500">
      <div role="img" aria-label={`Hero background for ${movie.name}`} className="relative h-[70vh] w-full overflow-hidden">
        <img src={movie.imageUrl} className="w-full h-full object-cover transition-transform duration-[10s] scale-105" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-transparent" />
        <button onClick={onBack} className="absolute top-8 left-8 md:left-16 z-30 bg-black/40 backdrop-blur-md text-white p-3 rounded-full hover:bg-red-600 transition-all border border-white/10 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="absolute bottom-16 left-8 md:left-20 right-8 max-w-5xl">
          <div className="flex items-center gap-5 mb-8">
            <img src={movie.logoUrl} className="h-10 md:h-14 w-auto brightness-200" alt="" />
            <div className="h-8 w-px bg-white/20 mx-2" />
            <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-[0.2em]">{movie.category}</span>
          </div>
          <h1 className="text-6xl md:text-9xl font-black text-white drop-shadow-2xl mb-8 tracking-tighter leading-[0.9] italic">
            {movie.name}
          </h1>
          <div className="flex flex-wrap gap-5">
            <button onClick={() => onPlay(movie, true)} className="bg-red-600 text-white px-12 py-5 rounded-2xl font-black hover:bg-red-700 transition-all flex items-center gap-4 text-xl shadow-2xl active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              {t.watchNow}
            </button>
            <button onClick={() => onPlay(movie, false)} className="bg-white/10 text-white px-10 py-5 rounded-2xl font-black hover:bg-white/20 transition-all flex items-center gap-4 text-lg backdrop-blur-xl border border-white/10 active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              {t.trailer}
            </button>
            <button onClick={() => onToggleWatchlist(movie)} className="w-16 h-16 bg-white/5 border-2 border-white/20 text-white rounded-2xl flex items-center justify-center hover:border-white transition-all backdrop-blur-xl active:scale-90">
               {inList ? <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-red-600"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>}
            </button>
            <button onClick={handleDownloadClick} className="w-16 h-16 bg-white/5 border border-white/20 text-white rounded-2xl flex items-center justify-center transition-all hover:bg-white/10 hover:border-red-600/50 active:scale-90">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-8 md:px-16 py-20 space-y-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-12">
            <div className="flex flex-wrap items-center gap-8 text-sm font-black">
              <span className="text-green-500 font-black px-3 py-1 bg-green-500/10 rounded border border-green-500/20">{movie.matchScore}% {t.match}</span>
              <span className="text-gray-400 font-bold">{movie.year}</span>
              <span className="bg-white/5 px-3 py-1 rounded text-[11px] uppercase tracking-widest text-gray-300 font-black border border-white/10">{movie.rating}</span>
              <span className="text-gray-400 font-bold">{movie.duration}</span>
              <div className="flex gap-2">{movie.genre.map(g => <span key={g} className="text-xs font-black text-red-600 uppercase tracking-widest">{g}</span>)}</div>
            </div>
            <section className="space-y-6">
              <h2 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em]">{t.narrative}</h2>
              <p className="text-3xl text-white leading-[1.2] font-medium tracking-tight">{movie.synopsis}</p>
              <p className="text-gray-400 leading-relaxed text-xl">{movie.description}</p>
            </section>
            <section className="space-y-10 pt-10 border-t border-white/5">
              <h3 className="text-3xl font-black text-white tracking-tighter">{t.reception}</h3>
              <form onSubmit={handleAddComment} className="space-y-4">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={user ? "Share your review..." : "Sign in to review"} disabled={!user} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-medium outline-none focus:border-red-600 transition-all resize-none disabled:opacity-50" rows={3} />
                <div className="flex justify-end">
                  <button type="submit" disabled={!user || !comment.trim()} className="bg-white text-black px-8 py-3 rounded-full font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 disabled:opacity-30">
                    {t.postReview}
                  </button>
                </div>
              </form>
              <div className="space-y-8">
                {comments.map(c => (
                  <article key={c.id} className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black text-xs text-white">{c.user.charAt(0)}</div>
                        <div>
                          <p className="font-black text-white">{c.user}</p>
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{c.date}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 font-medium leading-relaxed">{c.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-12 bg-white/5 p-10 rounded-[2.5rem] border border-white/10 h-fit sticky top-32">
            <div>
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">{t.cast}</h4>
              <ul className="space-y-5">{movie.cast.map(c => <li key={c} className="flex items-center gap-4 group"><div className="w-10 h-10 rounded-xl bg-red-600/10 border border-white/5 flex items-center justify-center text-[12px] font-black text-white group-hover:bg-red-600 transition-colors">{c.charAt(0)}</div><span className="text-base font-bold text-gray-300 group-hover:text-white">{c}</span></li>)}</ul>
            </div>
          </aside>
        </div>
      </div>
      {showDownloadConfig && <DownloadModal service={movie} onClose={() => setShowDownloadConfig(false)} />}
    </main>
  );
};

export default MovieDetailsPage;
