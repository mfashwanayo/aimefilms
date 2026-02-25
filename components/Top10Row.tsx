
import React from 'react';
import { StreamingService } from '../types';

interface Top10RowProps {
  title: string;
  services: StreamingService[];
  onSelect: (service: StreamingService) => void;
}

const Top10Row: React.FC<Top10RowProps> = ({ title, services, onSelect }) => {
  // Limit to actual Top 10 and duplicate for infinite marquee
  const top10 = services.slice(0, 10);
  const displayServices = [...top10, ...top10];

  return (
    <section className="mb-20 px-4 md:px-12 relative overflow-hidden group/row">
      {/* Cinematic Header */}
      <div className="flex items-center gap-4 mb-10 px-4">
        <h3 className="text-2xl md:text-4xl font-[1000] text-white uppercase italic tracking-tighter leading-none">
          {title}
        </h3>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-red-600/50 via-white/5 to-transparent" />
      </div>
      
      {/* Infinite Marquee Container */}
      <div className="relative overflow-visible">
        <div className="animate-marquee py-8 md:py-12">
          {displayServices.map((service, idx) => {
            const rank = (idx % 10) + 1;
            return (
              <div 
                key={`${service.id}-${idx}`} 
                onClick={() => onSelect(service)}
                className="flex-none w-44 sm:w-52 md:w-64 mx-1 relative cursor-pointer group/card transition-all duration-500 hover:scale-105"
              >
                {/* Compact Rank Number - Small and Bottom Aligned */}
                <div className="absolute left-1 bottom-[-5px] md:bottom-[-10px] z-20 select-none pointer-events-none transition-all duration-500 group-hover/card:-translate-y-1">
                  <span className="text-[60px] sm:text-[80px] md:text-[100px] font-[1000] leading-none tracking-tighter stroke-text italic drop-shadow-[0_5px_15px_rgba(0,0,0,1)] opacity-90 group-hover/card:opacity-100 group-hover/card:text-red-600 transition-colors">
                    {rank}
                  </span>
                </div>

                {/* High-Fidelity Poster - Tight Spacing */}
                <div className="relative aspect-[2/3] overflow-hidden rounded-[1.2rem] md:rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] ml-10 md:ml-16 border border-white/5 group-hover/card:border-red-600/50 transition-all duration-500 bg-[#0a0a0a]">
                  <img 
                    src={service.imageUrl} 
                    alt={service.name}
                    className="w-full h-full object-cover transition-transform duration-[2s] group-hover/card:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Glass Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover/card:opacity-40 transition-opacity" />
                  
                  {/* Quick Info Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all duration-500 z-30">
                    <p className="text-white font-black text-[10px] md:text-xs italic uppercase tracking-tighter truncate">{service.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-red-500 text-[6px] md:text-[8px] font-black uppercase tracking-widest">{service.genre[0]}</span>
                      <div className="w-1 h-1 bg-white/20 rounded-full" />
                      <span className="text-white/40 text-[6px] md:text-[8px] font-bold">{service.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Depth Gradients */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-40 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 md:w-40 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  );
};

export default Top10Row;
