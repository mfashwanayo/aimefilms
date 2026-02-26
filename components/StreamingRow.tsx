
import React, { useRef } from 'react';
import { StreamingService } from '../types';
import ServiceCard from './ServiceCard';

interface StreamingRowProps {
  title: string;
  services: StreamingService[];
  onSelect: (service: StreamingService) => void;
}

const StreamingRow: React.FC<StreamingRowProps> = ({ title, services, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const rowId = `row-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section aria-labelledby={rowId} className="mb-14 px-6 lg:px-12 relative group">
      <div className="flex justify-between items-center mb-8">
        <h3 id={rowId} className="text-2xl lg:text-4xl font-black text-white tracking-tight">
          {title}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => scroll('left')}
            aria-label={`Scroll ${title} left`}
            className="w-10 h-10 rounded-lg bg-[#0c0c0c] border border-white/10 flex items-center justify-center text-white hover:bg-yellow-400 hover:text-black transition-all shadow-xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button 
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} right`}
            className="w-10 h-10 rounded-lg bg-[#0c0c0c] border border-white/10 flex items-center justify-center text-white hover:bg-yellow-400 hover:text-black transition-all shadow-xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6 6-6"/></svg>
          </button>
        </div>
      </div>
      
      <div className="relative">
        <div 
          ref={scrollRef}
          role="list"
          className="flex gap-6 overflow-x-auto scrollbar-hide no-scrollbar py-4 focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-4"
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
    </section>
  );
};

export default StreamingRow;
