import React from 'react';
import Logo from './Logo';
import { Brand, User } from '../types';

interface StreamingSidebarProps {
  onHome: () => void;
  onCategoryFilter: (category: string) => void;
  onSwitchBrand: () => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenAccount: () => void;
  activeCategory: string;
  brand: Brand;
  user: User | null;
}

const discoveryItems = [
  { label: 'Home', icon: '⌂', category: null },
  { label: 'New releases', icon: '✦', category: 'New Releases' },
  { label: 'Movies', icon: '▶', category: 'Movies' },
  { label: 'TV series', icon: '▣', category: 'Series' },
  { label: 'Trending now', icon: '↗', category: 'Trending' },
];
const libraryItems = [
  { label: 'Saved films', icon: '▣', category: 'Watchlist' },
  { label: 'Continue watching', icon: '◷', category: 'Continue Watching' },
];
const genreItems = [
  { label: 'Action', icon: '⚡', category: 'Action' },
  { label: 'Comedy', icon: '☻', category: 'Comedy' },
  { label: 'Drama', icon: '◇', category: 'Drama' },
  { label: 'Horror', icon: '◉', category: 'Horror' },
  { label: 'Animation', icon: '✦', category: 'Animation' },
];
const languageItems = [
  { label: 'Kinyarwanda', icon: 'RW', category: 'Kinyarwanda' },
  { label: 'Films in Rwanda', icon: '◎', category: 'Rwanda' },
  { label: 'English', icon: 'EN', category: 'English' },
];

const PrinceFilmsSidebar: React.FC<StreamingSidebarProps> = ({
  onHome, onCategoryFilter, onSwitchBrand, onOpenAuth, onOpenAccount, activeCategory, brand, user,
}) => {
  const brandName = brand === 'filmsnyarwanda' ? 'FilmsNyarwanda' : brand === 'princefilms' ? 'PrinceFilms' : 'AimeFilms';
  const activeAccent = brand === 'filmsnyarwanda' ? 'text-yellow-300' : brand === 'princefilms' ? 'text-violet-300' : 'text-red-300';
  const renderItems = (items: { label: string; icon: string; category: string | null }[]) =>
    items.map(item => {
      const isActive = item.category === null ? activeCategory === 'all' : activeCategory === item.category;
      return (
        <button key={item.label} type="button" aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            if (!item.category) { onHome(); return; }
            if ((item.category === 'Watchlist' || item.category === 'Continue Watching') && !user) { onOpenAuth('signin'); return; }
            onCategoryFilter(item.category);
          }}
          className={`streaming-nav-link ${isActive ? 'is-active' : ''}`}>
          <span className="streaming-nav-icon">{item.icon}</span><span>{item.label}</span>
        </button>
      );
    });

  return (
    <aside aria-label={`${brandName} browsing menu`} className="streaming-sidebar hidden md:flex fixed left-0 top-0 bottom-0 z-[95] w-64 flex-col border-r border-white/10 px-4 pb-5 pt-6">
      <button type="button" onClick={onHome} aria-label={`${brandName} home`} className="mb-8 px-2 text-left">
        <Logo size="sm" brand={brand} />
      </button>
      <div className="flex-1 overflow-y-auto pr-1">
        <section className="mb-6">
          <p className={`mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] ${activeAccent} opacity-70`}>Discover</p>
          <div className="space-y-1">{renderItems(discoveryItems)}</div>
        </section>
        <section className="mb-6">
          <p className={`mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] ${activeAccent} opacity-70`}>Your library</p>
          <div className="space-y-1">{renderItems(libraryItems)}</div>
        </section>
        <section className="mb-6">
          <p className={`mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] ${activeAccent} opacity-70`}>Genres</p>
          <div className="space-y-1">{renderItems(genreItems)}</div>
        </section>
        <section className="mb-6">
          <p className={`mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] ${activeAccent} opacity-70`}>Languages</p>
          <div className="space-y-1">{renderItems(languageItems)}</div>
        </section>
      </div>
      <button type="button" onClick={onOpenAccount} className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-white/55 transition hover:bg-white/5 hover:text-white">
        <span className="streaming-nav-icon">⚙</span> Settings / Account
      </button>
      <div className="streaming-brand-card rounded-2xl border p-4">
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${activeAccent}`}>{brandName}</p>
        <p className="mt-2 text-sm font-bold leading-snug text-white">Your next film is waiting.</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">Explore films by genre, language and what is trending now.</p>
      </div>
      <button type="button" onClick={onSwitchBrand} className="mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-white/45 transition hover:bg-white/5 hover:text-white">
        <span className="text-lg">⇄</span> Switch website
      </button>
    </aside>
  );
};

export default PrinceFilmsSidebar;
