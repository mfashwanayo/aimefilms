import React from 'react';
import { Brand, StreamingService } from '../types';

interface Top10RowProps {
  title: string;
  services: StreamingService[];
  onSelect: (service: StreamingService) => void;
  brand?: Brand;
}

const Top10Row: React.FC<Top10RowProps> = ({ title, services, onSelect, brand = 'aimefilms' }) => {
  const top10 = services.slice(0, 10);
  const displayServices = [...top10, ...top10];
  const isPrinceFilms = brand === 'princefilms';

  return (
    <section className={`mb-12 px-4 md:px-7 lg:px-9 relative group/row ${isPrinceFilms ? 'princefilms-top10' : brand === 'filmsnyarwanda' ? 'filmsnyarwanda-top10' : 'aimefilms-top10'}`}>
      <div className="flex items-end gap-4 mb-5 md:mb-6 px-1">
        <div>
          {isPrinceFilms && <p className="text-[9px] font-extrabold tracking-[0.24em] text-violet-300/65 uppercase mb-1">Popular this week</p>}
          <h3 className={`font-black text-white tracking-tight ${isPrinceFilms ? 'text-lg md:text-xl' : 'text-2xl md:text-4xl uppercase italic tracking-tighter'}`}>
            {title}
          </h3>
        </div>
        <div className={`h-px flex-1 bg-gradient-to-r via-white/5 to-transparent mb-2 ${isPrinceFilms ? 'from-violet-500/60' : brand === 'filmsnyarwanda' ? 'from-yellow-500/60' : 'from-red-600/50'}`} />
      </div>

      {isPrinceFilms ? (
        <div role="list" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5 px-1">
          {top10.map((service, idx) => (
            <button
              type="button"
              role="listitem"
              key={service.id}
              onClick={() => onSelect(service)}
              aria-label={`Open number ${idx + 1}: ${service.name}`}
              className="min-w-0 text-left group/card focus-visible:outline-2 focus-visible:outline-violet-300 rounded-xl"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] transition-all duration-300 group-hover/card:border-violet-300/40 group-hover/card:-translate-y-1 group-hover/card:shadow-[0_16px_40px_-20px_rgba(139,92,246,0.85)]">
                <img
                  src={service.imageUrl}
                  alt={`Poster for ${service.name}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
                <span className="absolute top-2 left-2 rounded-md border border-violet-200/25 bg-[#171024]/90 px-2 py-1 text-[10px] font-black text-violet-200 backdrop-blur-md">
                  #{idx + 1}
                </span>
                <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white">
                  ★ {service.rating}
                </span>
                <div className="absolute inset-x-3 bottom-3">
                  <p className="text-sm font-bold leading-snug text-white line-clamp-2">{service.name}</p>
                  <p className="mt-1 text-[10px] font-semibold text-white/65">{service.year} · {service.genre[0]}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="relative overflow-visible">
          <div className="animate-marquee py-8 md:py-12">
            {displayServices.map((service, idx) => {
              const rank = (idx % 10) + 1;
              return (
                <button
                  type="button"
                  key={`${service.id}-${idx}`}
                  onClick={() => onSelect(service)}
                  aria-label={`Open number ${rank}: ${service.name}`}
                  className="flex-none w-44 sm:w-52 md:w-64 mx-1 relative cursor-pointer group/card transition-all duration-500 hover:scale-105 text-left"
                >
                  <div className="absolute left-1 bottom-[-5px] md:bottom-[-10px] z-20 select-none pointer-events-none transition-all duration-500 group-hover/card:-translate-y-1">
                    <span className="text-[60px] sm:text-[80px] md:text-[100px] font-[1000] leading-none tracking-tighter stroke-text italic drop-shadow-[0_5px_15px_rgba(0,0,0,1)] opacity-90 group-hover/card:opacity-100 group-hover/card:text-red-600 transition-colors">
                      {rank}
                    </span>
                  </div>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[1.2rem] md:rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] ml-10 md:ml-16 border border-white/5 group-hover/card:border-red-600/50 transition-all duration-500 bg-[#0a0a0a]">
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="w-full h-full object-cover transition-transform duration-[2s] group-hover/card:scale-110"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover/card:opacity-40 transition-opacity" />
                    <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all duration-500 z-30">
                      <p className="text-white font-black text-[10px] md:text-xs italic uppercase tracking-tighter truncate">{service.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[6px] md:text-[8px] font-black uppercase tracking-widest ${brand === 'filmsnyarwanda' ? 'text-yellow-400' : 'text-red-500'}`}>{service.genre[0]}</span>
                        <div className="w-1 h-1 bg-white/20 rounded-full" />
                        <span className="text-white/60 text-[6px] md:text-[8px] font-bold">{service.rating}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="absolute inset-y-0 left-0 w-16 md:w-40 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 md:w-40 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />
        </div>
      )}
    </section>
  );
};

export default Top10Row;
