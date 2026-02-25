
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
    <section aria-labelledby={rowId} className="mb-10 px-6 lg:px-12 relative group">
      <h3 id={rowId} className="text-xl lg:text-2xl font-bold mb-4 text-gray-200 group-hover:text-white transition-colors">
        {title}
      </h3>
      
      <div className="relative">
        <button 
          onClick={() => scroll('left')}
          aria-label={`Scroll ${title} left`}
          className="absolute left-0 top-0 bottom-0 z-40 bg-black/40 text-white px-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 focus-visible:opacity-100"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        <div 
          ref={scrollRef}
          role="list"
          className="flex gap-4 overflow-x-auto scrollbar-hide no-scrollbar py-4 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          tabIndex={0}
        >
          {services.map((service) => (
            <div key={service.id} role="listitem">
              <ServiceCard service={service} onClick={() => onSelect(service)} />
            </div>
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          aria-label={`Scroll ${title} right`}
          className="absolute right-0 top-0 bottom-0 z-40 bg-black/40 text-white px-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 focus-visible:opacity-100"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-9-6"/></svg>
        </button>
      </div>
    </section>
  );
};

export default StreamingRow;
