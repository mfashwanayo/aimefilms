import React from 'react';
import Logo from './Logo';

interface PrinceFilmsSidebarProps {
  onHome: () => void;
  onCategoryFilter: (category: string) => void;
  onSwitchBrand: () => void;
}

const discoveryItems = [
  { label: 'Home', icon: '⌂', category: null },
  { label: 'Movies', icon: '▶', category: 'Movies' },
  { label: 'TV Series', icon: '▣', category: 'Series' },
  { label: 'Trending now', icon: '↗', category: 'Trending' },
];

const genreItems = [
  { label: 'Action', icon: '⚡', category: 'Action' },
  { label: 'Horror', icon: '◉', category: 'Horror' },
  { label: 'Animation', icon: '✦', category: 'Animation' },
];

const languageItems = [
  { label: 'Kinyarwanda', icon: 'RW', category: 'Kinyarwanda' },
  { label: 'Films in Rwanda', icon: '◎', category: 'Rwanda' },
  { label: 'English', icon: 'EN', category: 'English' },
];

const PrinceFilmsSidebar: React.FC<PrinceFilmsSidebarProps> = ({ onHome, onCategoryFilter, onSwitchBrand }) => {
  const renderItems = (items: { label: string; icon: string; category: string | null }[]) => items.map((item) => (
    <button
      key={item.label}
      type="button"
      onClick={() => item.category ? onCategoryFilter(item.category) : onHome()}
      className="princefilms-nav-link"
    >
      <span className="princefilms-nav-icon">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  ));

  return (
    <aside aria-label="PrinceFilms browsing menu" className="princefilms-sidebar hidden md:flex fixed left-0 top-0 bottom-0 z-[95] w-64 flex-col border-r border-white/10 px-4 pb-5 pt-6">
      <button type="button" onClick={onHome} aria-label="PrinceFilms home" className="mb-8 px-2 text-left">
        <Logo size="sm" brand="princefilms" />
      </button>

      <div className="flex-1 overflow-y-auto pr-1">
        <section className="mb-7">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-violet-300/60">Discover</p>
          <div className="space-y-1">{renderItems(discoveryItems)}</div>
        </section>
        <section className="mb-7">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-violet-300/60">Genres</p>
          <div className="space-y-1">{renderItems(genreItems)}</div>
        </section>
        <section className="mb-7">
          <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-violet-300/60">Languages</p>
          <div className="space-y-1">{renderItems(languageItems)}</div>
        </section>
      </div>

      <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-200">PrinceFilms</p>
        <p className="mt-2 text-sm font-bold leading-snug text-white">Your next favorite story starts here.</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">Browse the collection by genre, language, or what is trending.</p>
      </div>

      <button type="button" onClick={onSwitchBrand} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-white/45 transition hover:bg-white/5 hover:text-white">
        <span className="text-lg">⇄</span> Switch website
      </button>
    </aside>
  );
};

export default PrinceFilmsSidebar;
