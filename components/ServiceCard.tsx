
import React from 'react';
import { StreamingService } from '../types';

interface ServiceCardProps {
  service: StreamingService;
  onClick: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  const isRecommended = service.matchScore > 90;

  return (
    <article 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`View details for ${service.name}`}
      className="flex-none w-56 md:w-64 relative cursor-pointer group transition-all duration-300 focus-visible:scale-[1.02]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl transition-all duration-500 shadow-xl group-hover:shadow-red-600/20 group-hover:-translate-y-2">
        <img 
          src={service.imageUrl} 
          alt={`Poster for ${service.name}`}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Studio Pick Badge */}
        {isRecommended && (
          <div className="absolute top-4 left-4 z-20 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1 uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-1000">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
            Studio Pick
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>

      <div className="mt-4 px-1 text-left">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-white font-black text-lg leading-tight group-hover:text-red-500 transition-colors line-clamp-1">
            {service.name}
          </h4>
          <span className="bg-white/5 border border-white/10 text-gray-400 text-[10px] font-black px-1.5 py-0.5 rounded">
            <span className="sr-only">Rating: </span>{service.rating}
          </span>
        </div>
        <p className="text-gray-400 text-xs font-medium mt-1 line-clamp-2 leading-relaxed">
          {service.description}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{service.year}</span>
          <span aria-hidden="true" className="w-1 h-1 bg-gray-800 rounded-full" />
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{service.genre[0]}</span>
        </div>
      </div>
    </article>
  );
};

export default ServiceCard;
