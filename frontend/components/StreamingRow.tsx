import React, { useRef } from 'react';
import { Brand, StreamingService } from '../types';
import ServiceCard from './ServiceCard';

interface StreamingRowProps {
  title: string;
  services: StreamingService[];
  onSelect: (service: StreamingService) => void;
  brand?: Brand;
}

const StreamingRow: React.FC<StreamingRowProps> = ({ title, services, onSelect, brand = 'aimefilms' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPrinceFilms = brand === 'princefilms';
  const rowId = `row-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth,
      behavior: 'smooth',
    });
  };

  return (
    <section
      aria-labelledby={rowId}
      className={`mb-12 px-5 md:px-7 lg:px-9 relative group ${isPrinceFilms ? 'princefilms-row' : brand === 'filmsnyarwanda' ? 'filmsnyarwanda-row' : 'aimefilms-row'}`}
    >
      <div className="flex justify-between items-end gap-4 mb-5 md:mb-6">
        <div className="min-w-0">
          {isPrinceFilms && (
            <p className="text-[9px] font-extrabold tracking-[0.24em] text-violet-300/65 uppercase mb-1">Curated for you</p>
          )}
          <h3 id={rowId} className={`font-black text-white tracking-tight ${isPrinceFilms ? 'text-lg md:text-xl' : 'text-2xl lg:text-4xl'}`}>
            {title}
          </h3>
        </div>
        {isPrinceFilms ? (
          <span className="shrink-0 text-[10px] font-semibold tracking-wide text-white/40">{services.length} titles</span>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label={`Scroll ${title} left`}
              className={`w-9 h-9 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-center text-white transition-all shadow-xl ${brand === 'filmsnyarwanda' ? 'hover:bg-yellow-400 hover:text-black' : 'hover:bg-red-600 hover:text-white'}`}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label={`Scroll ${title} right`}
              className={`w-9 h-9 rounded-xl bg-white/[0.035] border border-white/10 flex items-center justify-center text-white transition-all shadow-xl ${brand === 'filmsnyarwanda' ? 'hover:bg-yellow-400 hover:text-black' : 'hover:bg-red-600 hover:text-white'}`}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6 6-6"/></svg>
            </button>
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-white/80">No films found</p>
          <p className="mt-1 text-xs text-white/45">Try another title or category.</p>
        </div>
      ) : isPrinceFilms ? (
        <div role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 lg:gap-x-5 gap-y-7">
          {services.map((service) => (
            <div key={service.id} role="listitem" className="min-w-0">
              <ServiceCard service={service} onClick={() => onSelect(service)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            role="list"
            className="flex gap-6 overflow-x-auto scrollbar-hide no-scrollbar py-4 focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            tabIndex={0}
          >
            {services.map((service) => (
              <div key={service.id} role="listitem">
                <ServiceCard service={service} onClick={() => onSelect(service)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default StreamingRow;
