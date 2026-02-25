
import React from 'react';
import { Language, Brand } from '../types';
import { translations } from '../locales/translations';

interface HeroProps {
  onOpenAI: () => void;
  onDiscoverMore: () => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  user?: any | null;
  language: Language;
  brand: Brand;
}

const Hero: React.FC<HeroProps> = ({ onOpenAI, onDiscoverMore, onOpenAuth, user, language, brand }) => {
  const t = translations[language].hero;

  const brandColors = {
    aimefilms: 'text-red-600',
    tntfilms: 'text-blue-600',
    princefilms: 'text-purple-600'
  };

  const brandBg = {
    aimefilms: 'bg-red-600',
    tntfilms: 'bg-blue-600',
    princefilms: 'bg-purple-600'
  };

  return (
    <section aria-labelledby="hero-title" className="relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col justify-center px-6 md:px-12 lg:px-24 py-16 md:py-24">
      {/* Background Container with Responsive Mask */}
      <div 
        className="absolute inset-x-2 md:inset-x-10 top-0 bottom-6 md:bottom-10 hero-mask overflow-hidden z-0 shadow-2xl"
        role="presentation"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[30s] ease-out scale-110"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <div className={`absolute inset-0 ${brandBg[brand]}/10 mix-blend-multiply`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
        </div>
      </div>

      <div className="relative z-10 max-w-5xl animate-in fade-in slide-in-from-bottom-12 duration-1000">
        <h2 id="hero-title" className="text-4xl sm:text-6xl md:text-8xl lg:text-[9rem] font-[900] mb-6 md:mb-8 leading-[0.9] tracking-tighter italic uppercase text-white drop-shadow-2xl">
          {t.title}<br />
          <span className={brandColors[brand]}>{t.reimagined}.</span>
        </h2>
        
        <p className="text-base md:text-xl lg:text-2xl text-gray-200 mb-10 md:mb-12 font-semibold leading-relaxed max-w-2xl drop-shadow-md opacity-90">
          {t.subtitle}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
          <button 
            onClick={onOpenAI}
            className="flex items-center justify-center gap-3 md:gap-4 bg-white text-black px-8 md:px-10 py-5 md:py-6 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl active:scale-95 group"
          >
            <div className={`w-6 h-6 md:w-8 md:h-8 ${brandBg[brand]} rounded-full flex items-center justify-center animate-pulse group-hover:scale-110 transition-transform`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" className="md:w-4 md:h-4"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
            </div>
            {t.aiBtn}
          </button>
          
          <button 
            onClick={onDiscoverMore}
            className="flex items-center justify-center gap-3 md:gap-4 bg-black/40 text-white px-8 md:px-10 py-5 md:py-6 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-white/10 transition-all backdrop-blur-xl border border-white/20 group active:scale-95 shadow-2xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform md:w-6 md:h-6"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            {t.exploreBtn}
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
