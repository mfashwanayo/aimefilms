
import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { Language } from '../types';
import { translations } from '../locales/translations';

interface WelcomePopupProps {
  onStart: () => void;
  language: Language;
}

const WelcomePopup: React.FC<WelcomePopupProps> = ({ onStart, language }) => {
  const [isVisible, setIsVisible] = useState(false);
  const t = translations[language].welcome;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className={`relative max-w-lg w-full text-center space-y-12 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}>
        <div className="flex justify-center">
          <div className="animate-in fade-in slide-in-from-top-10 duration-1000">
            <Logo size="xl" className="justify-center" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            {t.title}
          </h2>
          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-sm mx-auto">
            {t.subtitle}
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={onStart}
            className="group relative px-12 py-5 bg-red-600 text-white text-xl font-bold rounded-full overflow-hidden transition-all hover:bg-red-700 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(220,38,38,0.3)]"
          >
            <span className="relative z-10 flex items-center gap-3">
              {t.startBtn}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-500 group-hover:translate-x-2"><path d="m9 18 6-6-6-6"/></svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup;
