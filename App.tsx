
import React, { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import StreamingRow from './components/StreamingRow';
import Top10Row from './components/Top10Row';
import MovieDetailsPage from './components/MovieDetailsPage';
import AIStudio from './components/AIAssistant';
import VideoPlayer from './components/VideoPlayer';
import AuthModal from './components/AuthModal';
import AccountModal from './components/AccountModal';
import AdminDashboard from './components/AdminDashboard';
import WelcomePopup from './components/WelcomePopup';
import LegalModal from './components/LegalModal';
import ContactAdminModal from './components/ContactAdminModal';
import Logo from './components/Logo';
import SiteSelector from './components/SiteSelector';
import { AimeFilmsAPI } from './services/api';
import { StreamingService, User, Language, Brand } from './types';
import { translations } from './locales/translations';

type ViewState = 'home' | 'detail';

const App: React.FC = () => {
  const [allMovies, setAllMovies] = useState<StreamingService[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [searchResults, setSearchResults] = useState<StreamingService[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [selectedService, setSelectedService] = useState<StreamingService | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{service: StreamingService, isFull: boolean} | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState<string | undefined>(undefined);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [continueWatching, setContinueWatching] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>('EN');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean, type: 'privacy' | 'terms' }>({ isOpen: false, type: 'privacy' });
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('aimefilms_user');
    setIsAccountOpen(false);
    setIsAdminOpen(false);
    setCurrentView('home');
  };

  const handleSwitchAccount = () => {
    handleLogout();
    setAuthMode('signin');
    setIsAuthOpen(true);
  };

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);
  const t = translations[language];

  // Listener to refresh Top 10 in real-time when views update
  useEffect(() => {
    const handleViewUpdate = () => {
      setViewCounts(AimeFilmsAPI.getViewCounts());
    };
    window.addEventListener('aimefilms_view_updated', handleViewUpdate);
    return () => window.removeEventListener('aimefilms_view_updated', handleViewUpdate);
  }, []);

  useEffect(() => {
    if (user) {
      setWatchlist(AimeFilmsAPI.fetchWatchlist(user.email));
      setContinueWatching(AimeFilmsAPI.fetchContinueWatching(user.email));
    } else {
      setWatchlist([]);
      setContinueWatching([]);
    }
  }, [user]);

  useEffect(() => {
    initApp();
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin_portal') === 'true') {
      const savedUser = localStorage.getItem('aimefilms_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.role === 'admin') {
          setIsAdminOpen(true);
        }
      }
    }
  }, []);

  const initApp = async () => {
    setIsLoading(true);
    try {
      const movies = await AimeFilmsAPI.getMovies();
      setAllMovies(movies);
      setViewCounts(AimeFilmsAPI.getViewCounts());
      const hasStarted = sessionStorage.getItem('aimefilms_started');
      if (hasStarted) setShowWelcome(false);
      const savedLang = localStorage.getItem('aimefilms_lang') as Language;
      if (savedLang) setLanguage(savedLang);
      const savedUser = localStorage.getItem('aimefilms_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      }
      const savedBrand = localStorage.getItem('aimefilms_brand') as Brand;
      if (savedBrand) setSelectedBrand(savedBrand);
    } catch (err) {
      console.error("API Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('aimefilms_lang', lang);
  };

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length >= 2) {
        const results = await AimeFilmsAPI.search(searchQuery);
        setSearchResults(results);
        if (currentView === 'detail') setCurrentView('home');
      } else {
        setSearchResults(null);
      }
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentView]);

  const handleStartStream = () => {
    setShowWelcome(false);
    sessionStorage.setItem('aimefilms_started', 'true');
  };

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    localStorage.setItem('aimefilms_brand', brand);
  };

  const handleSwitchBrand = () => {
    setSelectedBrand(null);
    localStorage.removeItem('aimefilms_brand');
    handleGoHome();
  };

  const handleSelectMovie = (movie: StreamingService) => {
    setSelectedService(movie);
    setCurrentView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setSelectedService(null);
    setSearchQuery('');
    setSearchResults(null);
    setActiveCategory('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleWatchlist = (service: StreamingService) => {
    if (!user) { setAuthMode('signin'); setIsAuthOpen(true); return; }
    const next = watchlist.includes(service.id) ? watchlist.filter(id => id !== service.id) : [...watchlist, service.id];
    setWatchlist(next);
    AimeFilmsAPI.syncWatchlist(user.email, next);
  };

  const isInWatchlist = (id: string) => watchlist.includes(id);

  const handlePlayVideo = (service: StreamingService, isFull: boolean = false) => {
    if (!user) { setAuthMode('signin'); setIsAuthOpen(true); return; }
    setPlayingVideo({ service, isFull });
    AimeFilmsAPI.trackMovieView(service.id, user.email);
    setContinueWatching(AimeFilmsAPI.fetchContinueWatching(user.email));
  };

  const handleExecuteAIAction = (action: { type: string, value: string }) => {
    if (action.type === 'FILTER') {
      setActiveCategory(action.value);
      setSearchQuery('');
      setCurrentView('home');
      setIsStudioOpen(false);
    } else if (action.type === 'SEARCH') {
      setSearchQuery(action.value);
      setActiveCategory('all');
      setCurrentView('home');
      setIsStudioOpen(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('aimefilms_user', JSON.stringify(userData));
    setIsAuthOpen(false);
    if (userData.role === 'admin') {
      // Open admin dashboard in a new tab simulation
      // In this environment, we'll just set the state, but we can try window.open
      const adminUrl = window.location.origin + '?admin_portal=true';
      window.open(adminUrl, '_blank');
      setIsAdminOpen(true);
    }
  };

  // Automated Top 10 System: Most Viewed + Admin manual flags
  const brandMovies = useMemo(() => {
    let movies = allMovies.filter(m => m.brand === selectedBrand);
    if (!isAdmin) {
      movies = movies.filter(m => !m.isHidden);
    }
    return movies;
  }, [allMovies, selectedBrand, isAdmin]);

  const trendingMovies = useMemo(() => {
    return [...brandMovies].sort((a, b) => {
      const viewsA = (viewCounts[a.id] || 0) + (a.isTrending ? 1000000 : 0);
      const viewsB = (viewCounts[b.id] || 0) + (b.isTrending ? 1000000 : 0);
      return viewsB - viewsA;
    }).slice(0, 10);
  }, [brandMovies, viewCounts]);

  const homeCategories = useMemo(() => {
    if (searchResults || activeCategory !== 'all') {
      const displayMovies = searchResults || brandMovies.filter(s => {
        if (activeCategory === 'Movies') return !s.genre.includes('TV Series');
        if (activeCategory === 'Series') return s.genre.includes('TV Series');
        if (activeCategory === 'Trending') return s.isTrending;
        return s.genre.some(g => g.toLowerCase() === activeCategory.toLowerCase());
      });
      return [{ id: 'filter-results', title: searchQuery ? `Results for "${searchQuery}"` : activeCategory, services: displayMovies }];
    }
    const categories = [
      { id: 'kinyarwanda', title: 'Films in Kinyarwanda', services: brandMovies.filter(m => m.section === 'kinyarwanda') },
      { id: 'rwanda', title: 'Films in Rwanda', services: brandMovies.filter(m => m.section === 'rwanda') },
      { id: 'english', title: 'Films in English', services: brandMovies.filter(m => m.section === 'english') },
      { id: 'recent', title: 'New Arrivals', services: brandMovies.slice(0, 8) },
      { id: 'action', title: 'Action', services: brandMovies.filter(s => s.genre.includes('Action')) },
      { id: 'horror', title: 'Horror', services: brandMovies.filter(s => s.genre.includes('Horror')) },
    ];
    if (user) {
      if (continueWatching.length > 0) {
        categories.splice(0, 0, { id: 'continue', title: 'Continue Watching', services: brandMovies.filter(s => continueWatching.includes(s.id)) });
      }
      if (watchlist.length > 0) {
        categories.splice(1, 0, { id: 'watchlist', title: 'My Watchlist', services: brandMovies.filter(s => watchlist.includes(s.id)) });
      }
    }
    return categories.filter(row => row.services.length > 0);
  }, [brandMovies, searchResults, activeCategory, watchlist, continueWatching, searchQuery, user]);

  if (isLoading && !showWelcome) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectionColor = useMemo(() => {
    if (selectedBrand === 'filmsnyarwanda') return 'selection:bg-yellow-400 selection:text-black';
    if (selectedBrand === 'princefilms') return 'selection:bg-purple-600';
    return 'selection:bg-red-600';
  }, [selectedBrand]);

  if (!selectedBrand) {
    return <SiteSelector onSelect={handleBrandSelect} />;
  }

  return (
    <div className={`min-h-screen bg-[#000000] text-white brand-${selectedBrand} ${selectionColor} selection:text-white`}>
      {showWelcome && <WelcomePopup onStart={handleStartStream} language={language} />}

      <Navbar 
        onSearch={setSearchQuery} 
        onCategoryFilter={(cat) => { setActiveCategory(cat); setSearchQuery(''); setSearchResults(null); setCurrentView('home'); }}
        onOpenAuth={(mode) => { setAuthMode(mode as any); setIsAuthOpen(true); }}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onAboutClick={() => { setCurrentView('home'); setTimeout(() => document.getElementById('protocol-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
        user={user}
        onLogout={handleLogout}
        onLogoClick={handleGoHome}
        language={language}
        onLanguageChange={handleLanguageChange}
        brand={selectedBrand || 'aimefilms'}
        onSwitchBrand={handleSwitchBrand}
      />
      
      <main className={showWelcome ? 'hidden' : 'block pt-20'}>
        {currentView === 'home' ? (
          <>
            {!searchQuery && activeCategory === 'all' && (
              <Hero onOpenAI={() => { setStudioPrompt(undefined); setIsStudioOpen(true); }} onDiscoverMore={() => document.getElementById('top10-section')?.scrollIntoView({ behavior: 'smooth' })} onOpenAuth={(mode) => { setAuthMode(mode as any); setIsAuthOpen(true); }} user={user} language={language} brand={selectedBrand || 'aimefilms'} />
            )}
            <div className={`relative ${ (searchQuery || activeCategory !== 'all') ? 'pt-10' : '-mt-32'} z-20 pb-40 space-y-16`}>
              
              {!searchQuery && activeCategory === 'all' && trendingMovies.length > 0 && (
                <div id="top10-section" className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
                  <Top10Row title={t.nav.top10} services={trendingMovies} onSelect={handleSelectMovie} />
                </div>
              )}

              <div className="space-y-12">
                {homeCategories.map((cat, idx) => (
                  <div id={cat.id} key={cat.id} className="animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${idx * 100}ms` }}>
                    <StreamingRow title={cat.title} services={cat.services} onSelect={handleSelectMovie} />
                  </div>
                ))}
              </div>

              <section id="protocol-section" className="px-6 lg:px-16 max-w-7xl mx-auto py-20 border-y border-white/5 bg-gradient-to-b from-transparent via-white/5 to-transparent rounded-[4rem]">
                <div className="text-center mb-24">
                  <span className="text-[11px] font-black text-red-600 uppercase tracking-[0.6em] mb-4 block">{t.about.subtitle}</span>
                  <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic">{t.about.title}</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="p-10 bg-white/5 border border-white/5 rounded-[3rem] space-y-6 hover:bg-white/10 transition-all group">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/20 group-hover:scale-110 transition-transform">
                       <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tight">{t.about.missionTitle}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed">{t.about.missionText}</p>
                  </div>

                  <div className="p-10 bg-white/5 border border-white/5 rounded-[3rem] space-y-6 hover:bg-white/10 transition-all group">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20 group-hover:scale-110 transition-transform">
                       <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m4.93 4.93 14.14 14.14"/><path d="M2 12h20"/></svg>
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tight">{t.about.relayTitle}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed">{t.about.relayText}</p>
                  </div>

                  <div className="p-10 bg-white/5 border border-white/5 rounded-[3rem] space-y-6 hover:bg-white/10 transition-all group">
                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/20 group-hover:scale-110 transition-transform">
                       <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/><line x1="2" x2="22" y1="12" y2="12"/></svg>
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tight">{t.about.infraTitle}</h3>
                    <p className="text-gray-400 font-medium leading-relaxed">{t.about.infraText}</p>
                  </div>
                </div>
              </section>
            </div>
          </>
        ) : (
          <MovieDetailsPage movie={selectedService} user={user} onBack={handleGoHome} onPlay={handlePlayVideo} onToggleWatchlist={handleToggleWatchlist} isInWatchlist={isInWatchlist} onOpenAuth={(mode) => { setAuthMode(mode as any); setIsAuthOpen(true); }} onSelectRelated={handleSelectMovie} language={language} />
        )}
        
        <footer className="py-32 px-6 lg:px-16 border-t border-white/5 bg-[#000000] text-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
              <div className="space-y-10">
                <Logo size="md" className="-ml-3" brand={selectedBrand || 'aimefilms'} />
                <p className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] leading-loose max-w-xs">{t.footer.legacy}</p>
              </div>
              <div className="space-y-10">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.5em]">REPOSITORY</h4>
                <ul className="space-y-5">
                  <li><button onClick={handleGoHome} className="text-gray-500 hover:text-red-500 transition-colors text-xs font-black uppercase">{t.nav.movies}</button></li>
                  <li><button onClick={() => { setActiveCategory('Series'); setCurrentView('home'); }} className="text-gray-500 hover:text-red-500 transition-colors text-xs font-black uppercase">{t.nav.series}</button></li>
                </ul>
              </div>
              <div className="space-y-10">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.5em]">{t.nav.protocol}</h4>
                <ul className="space-y-5">
                  <li><button onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })} className="text-gray-500 hover:text-red-500 transition-colors text-xs font-black uppercase">Privacy</button></li>
                  <li><button onClick={() => setLegalModal({ isOpen: true, type: 'terms' })} className="text-gray-500 hover:text-red-500 transition-colors text-xs font-black uppercase">Terms</button></li>
                </ul>
              </div>
              <div className="space-y-10">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.5em]">NETWORK</h4>
                <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]" />
                     <span className="text-[10px] font-black uppercase text-green-500">Relay Active</span>
                  </div>
                  <button onClick={() => setIsContactOpen(true)} className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:text-white transition-colors">Contact Admin</button>
                </div>
              </div>
            </div>
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
              <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.4em]">{t.footer.rights}</p>
            </div>
          </div>
        </footer>
      </main>

      {isStudioOpen && (
        <AIStudio 
          onSelectService={(s) => { setIsStudioOpen(false); handleSelectMovie(s); }} 
          onExecuteAction={handleExecuteAIAction}
          onClose={() => { setIsStudioOpen(false); setStudioPrompt(undefined); }} 
          onLogin={handleLogin}
          language={language}
          user={user}
          initialPrompt={studioPrompt}
          currentMovie={selectedService}
          allMovies={allMovies}
          brand={selectedBrand || 'aimefilms'}
        />
      )}

      {isAdminOpen && isAdmin && <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} onRefresh={initApp} brand={selectedBrand || 'aimefilms'} />}
      {playingVideo && <VideoPlayer url={playingVideo.isFull ? playingVideo.service.fullMovieUrl : playingVideo.service.videoUrl} title={playingVideo.service.name} isFullMovie={playingVideo.isFull} onClose={() => setPlayingVideo(null)} />}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} onLogin={handleLogin} language={language} brand={selectedBrand || 'aimefilms'} />
      <AccountModal 
        isOpen={isAccountOpen} 
        onClose={() => setIsAccountOpen(false)} 
        user={user} 
        onUpdateUser={(updatedUser) => {
          setUser(updatedUser);
          localStorage.setItem('aimefilms_user', JSON.stringify(updatedUser));
        }} 
        onOpenAdmin={() => setIsAdminOpen(true)} 
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
        brand={selectedBrand || 'aimefilms'}
      />
      <LegalModal isOpen={legalModal.isOpen} type={legalModal.type} onClose={() => setLegalModal({ ...legalModal, isOpen: false })} />
      <ContactAdminModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} user={user} language={language} />
      
      {selectedBrand === 'filmsnyarwanda' && (
        <button 
          onClick={() => setIsContactOpen(true)}
          className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95 group"
        >
          <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20" />
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      )}
    </div>
  );
};

export default App;
