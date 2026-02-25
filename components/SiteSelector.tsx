
import React from 'react';
import { Brand } from '../types';
import Logo from './Logo';

interface SiteSelectorProps {
  onSelect: (brand: Brand) => void;
}

const SiteSelector: React.FC<SiteSelectorProps> = ({ onSelect }) => {
  const brands: { id: Brand; name: string; color: string; desc: string }[] = [
    { 
      id: 'aimefilms', 
      name: 'AimeFilms', 
      color: 'from-red-600/20 to-red-900/40 border-red-600/30', 
      desc: 'Premium Cinematic Network'
    },
    { 
      id: 'tntfilms', 
      name: 'TNTFilms', 
      color: 'from-blue-600/20 to-blue-900/40 border-blue-600/30', 
      desc: 'Explosive Action & Drama'
    },
    { 
      id: 'princefilms', 
      name: 'PrinceFilms', 
      color: 'from-purple-600/20 to-purple-900/40 border-purple-600/30', 
      desc: 'Royal Entertainment Hub'
    },
  ];

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-4xl w-full space-y-10 py-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-white">
            Choose Your <span className="text-red-600">Network</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">
            Select a brand to start your streaming experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => onSelect(brand.id)}
              className={`group relative p-8 rounded-[2.5rem] overflow-hidden border ${brand.color} bg-white/5 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-2xl flex flex-col items-center text-center space-y-6`}
            >
              <div className="transform group-hover:scale-110 transition-transform duration-500">
                <Logo size="md" brand={brand.id} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{brand.name}</h2>
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest leading-tight">{brand.desc}</p>
              </div>
              
              <div className="px-6 py-2 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                Enter
              </div>
            </button>
          ))}
        </div>

        <div className="text-center pt-8">
          <p className="text-gray-600 text-[9px] font-black uppercase tracking-[0.5em]">
            Powered by AimeFilms Intelligence • 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default SiteSelector;
