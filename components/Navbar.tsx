
import React, { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import { User, Language, Brand } from '../types';
import { translations } from '../locales/translations';

interface NavbarProps {
  onSearch: (query: string) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenAccount: () => void;
  onOpenAdmin: () => void;
  onAboutClick: () => void;
  onCategoryFilter: (category: string) => void;
  user?: User | null;
  onLogout?: () => void;
  onLogoClick?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  brand: Brand;
  onSwitchBrand: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  onSearch, 
  onOpenAuth, 
  onOpenAccount, 
  onOpenAdmin,
  onAboutClick, 
  onCategoryFilter,
  user, 
  onLogout,
  onLogoClick,
  language,
  onLanguageChange,
  brand,
  onSwitchBrand
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);

  const t = translations[language].nav;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setIsBrandOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (!isSearchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleLogoPress = () => {
    setIsMobileMenuOpen(false);
    if (onLogoClick) onLogoClick();
    else {
      onSearch('');
      onCategoryFilter('all');
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  };

  const handleNavClick = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  const languages: { code: Language, label: string }[] = [
    { code: 'EN', label: 'English' },
    { code: 'RW', label: 'Kinyarwanda' },
    { code: 'FR', label: 'Français' },
    { code: 'SW', label: 'Kiswahili' },
    { code: 'ZH', label: '中文 (Chinese)' }
  ];

  const isAdmin = user?.role === 'admin';

  const brands: { id: Brand, name: string, color: string }[] = [
    { id: 'aimefilms', name: 'AimeFilms', color: 'text-red-600' },
    { id: 'filmsnyarwanda', name: 'FilmsNyarwanda', color: 'text-yellow-500' },
    { id: 'princefilms', name: 'PrinceFilms', color: 'text-purple-600' }
  ];

  return (
    <header role="banner" className={`fixed top-0 w-full z-[100] transition-all duration-500 ${isScrolled || isMobileMenuOpen ? 'bg-black/95 backdrop-blur-md shadow-2xl border-b border-white/5' : 'bg-gradient-to-b from-black/95 to-transparent'}`}>
      <nav aria-label="Main Navigation" className="px-4 md:px-8 lg:px-12 py-4 md:py-5 flex items-center justify-between">
        
        <div className="flex items-center gap-4 md:gap-12">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-white hover:text-red-600 transition-colors"
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            )}
          </button>

          <button onClick={handleLogoPress} className="hover:scale-105 transition-transform flex-shrink-0">
            <Logo size="sm" brand={brand} />
          </button>
          
          <div className="hidden lg:flex gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
            <button onClick={handleLogoPress} className="hover:text-white transition-colors uppercase">{t.relay}</button>
            <button onClick={() => onCategoryFilter('Series')} className="hover:text-white transition-colors uppercase">{t.series}</button>
            {brand === 'filmsnyarwanda' && (
              <button onClick={() => onCategoryFilter('Categories')} className="hover:text-white transition-colors uppercase">{(t as any).categories}</button>
            )}
            <button onClick={() => onCategoryFilter('Movies')} className="hover:text-white transition-colors uppercase">{t.movies}</button>
            {brand === 'filmsnyarwanda' && (
              <button onClick={() => onCategoryFilter('FAQs')} className="hover:text-white transition-colors uppercase">{(t as any).faqs}</button>
            )}
            {brand !== 'filmsnyarwanda' && (
              <button onClick={() => onCategoryFilter('Trending')} className="hover:text-white transition-colors uppercase">{t.trends}</button>
            )}
            
            {/* Brand Switcher Desktop */}
            <div className="relative" ref={brandRef}>
              <button 
                onClick={() => setIsBrandOpen(!isBrandOpen)} 
                className={`${brand === 'filmsnyarwanda' ? 'text-yellow-500' : 'text-red-600'} hover:text-white transition-colors uppercase flex items-center gap-2`}
              >
                Switch Network
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isBrandOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {isBrandOpen && (
                <div className="absolute left-0 mt-4 w-48 bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {brands.map((b) => (
                    <button 
                      key={b.id} 
                      onClick={() => { onSwitchBrand(); setIsBrandOpen(false); }} 
                      className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest ${brand === b.id ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span className={b.color}>{b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-6">
          {/* Language Selector */}
          <div className="relative" ref={langRef}>
            <button onClick={() => setIsLangOpen(!isLangOpen)} className="text-gray-400 hover:text-white flex items-center gap-1 md:gap-2 p-1 md:p-2 rounded-xl transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span className="text-[9px] md:text-[10px] font-black">{language}</span>
            </button>
            {isLangOpen && (
              <div className="absolute right-0 mt-4 w-40 bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                {languages.map((lang) => (
                  <button key={lang.code} onClick={() => { onLanguageChange(lang.code); setIsLangOpen(false); }} className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest ${language === lang.code ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`flex items-center transition-all duration-500 ${isSearchVisible ? 'bg-white/5 border border-white/10 px-2 md:px-4 py-1.5 md:py-2 rounded-2xl shadow-inner' : ''}`}>
            <button onClick={toggleSearch} className={`text-white hover:${brand === 'filmsnyarwanda' ? 'text-yellow-500' : 'text-red-500'} transition-colors`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <input 
              ref={searchInputRef}
              type="text"
              placeholder={t.query}
              className={`bg-transparent text-white text-[10px] md:text-xs outline-none transition-all duration-500 font-black tracking-widest uppercase ${isSearchVisible ? 'w-24 md:w-72 ml-2 md:ml-3 opacity-100' : 'w-0 opacity-0'}`}
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {brand === 'filmsnyarwanda' && isSearchVisible && (
              <button className="bg-yellow-400 text-black p-1.5 rounded-lg ml-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </button>
            )}
          </div>
          
          {user ? (
            <div className="relative" ref={profileRef}>
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 group">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl ${isAdmin ? 'bg-blue-600' : brand === 'filmsnyarwanda' ? 'bg-yellow-400 text-black' : 'bg-red-600 text-white'} flex items-center justify-center font-black text-xs md:text-sm border border-transparent group-hover:border-white transition-all shadow-xl relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  {user.avatar ? (
                    <img src={user.avatar} className="relative z-10 w-full h-full object-cover" alt="Profile" />
                  ) : (
                    <span className="relative z-10">{user.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </button>
              
              {isProfileOpen && (
                <div className="absolute right-0 mt-4 w-64 bg-[#0c0c0c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                  <div className="p-6 border-b border-white/5">
                    <p className="text-sm font-black truncate text-white">{user.name}</p>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isAdmin ? 'text-blue-500' : 'text-gray-500'}`}>
                      {isAdmin ? 'Master Operations Director' : user.email}
                    </p>
                  </div>
                  <div className="p-2">
                    {isAdmin && (
                      <button onClick={() => handleNavClick(onOpenAdmin)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all">Admin Console</button>
                    )}
                    <button onClick={() => handleNavClick(onOpenAccount)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all">{t.account}</button>
                    <button onClick={() => handleNavClick(onLogout || (() => {}))} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-xl transition-all">{t.logout}</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 md:gap-4">
              {brand !== 'filmsnyarwanda' && (
                <button onClick={() => onOpenAuth('signin')} className="hidden md:block text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                  {t.login}
                </button>
              )}
              <button 
                onClick={() => onOpenAuth(brand === 'filmsnyarwanda' ? 'signin' : 'signup')} 
                className={`${brand === 'filmsnyarwanda' ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-red-600 text-white hover:bg-red-700'} px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black transition-all shadow-xl active:scale-95 uppercase tracking-widest`}
              >
                {brand === 'filmsnyarwanda' ? t.login : t.join}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Sidebar */}
        <div className={`fixed inset-0 z-[90] lg:hidden transition-all duration-500 ${isMobileMenuOpen ? 'visible' : 'invisible'}`}>
          <div className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`absolute left-0 top-0 bottom-0 w-[280px] bg-[#050505] border-r border-white/5 transition-transform duration-500 ease-out flex flex-col pt-24 px-6 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] mb-6">Library Navigation</h3>
              {[
                { label: t.relay, icon: '🏠', action: handleLogoPress },
                { label: t.movies, icon: '🎬', action: () => onCategoryFilter('Movies') },
                { label: t.series, icon: '📺', action: () => onCategoryFilter('Series') },
                { label: t.trends, icon: '🔥', action: () => onCategoryFilter('Trending') },
                { label: 'Switch Network', icon: '🔄', action: onSwitchBrand },
                { label: t.protocol, icon: '🛡️', action: onAboutClick }
              ].map((item, idx) => (
                <button key={idx} onClick={() => handleNavClick(item.action)} className="w-full text-left px-6 py-5 rounded-2xl bg-white/5 border border-white/5 text-sm font-black text-gray-400 hover:text-white hover:bg-red-600 transition-all flex items-center justify-between group">
                  <span>{item.label}</span>
                  <span className="opacity-40 group-hover:opacity-100">{item.icon}</span>
                </button>
              ))}
              {isAdmin && (
                <button onClick={() => handleNavClick(onOpenAdmin)} className="w-full text-left px-6 py-5 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-sm font-black text-blue-500 uppercase tracking-widest mt-10">Admin Backend</button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
