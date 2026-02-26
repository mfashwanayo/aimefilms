
import React from 'react';
import { Brand } from '../types';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  brand?: Brand;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', brand = 'aimefilms' }) => {
  const sizes = {
    sm: 'scale-[0.7]',
    md: 'scale-100',
    lg: 'scale-[1.3]',
    xl: 'scale-[2.0]'
  };

  const brandConfig = {
    aimefilms: {
      name: 'AIME',
      suffix: 'FILMS',
      color: 'from-red-500 to-red-900',
      accent: 'bg-red-600',
      icon: 'A',
      desc: 'Cinematic Network'
    },
    filmsnyarwanda: {
      name: 'Agasobanuye',
      suffix: 'FILMS',
      color: 'from-yellow-400 to-yellow-600',
      accent: 'bg-yellow-500',
      icon: 'A',
      desc: 'Local Network'
    },
    princefilms: {
      name: 'PRINCE',
      suffix: 'FILMS',
      color: 'from-purple-500 to-purple-900',
      accent: 'bg-purple-600',
      icon: 'P',
      desc: 'Royal Network'
    }
  };

  const config = brandConfig[brand];

  return (
    <div className={`flex items-center gap-4 group cursor-pointer select-none transition-all duration-500 ${sizes[size]} ${className}`}>
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className={`absolute inset-0 bg-gradient-to-br ${config.color} rounded-[14px] shadow-lg transition-all duration-500 group-hover:shadow-white/20 group-hover:scale-110 animate-pulse-slow`} />
        
        <div className="absolute inset-[1px] bg-gradient-to-tl from-black/20 to-white/10 rounded-[13px]" />

        <div className="relative z-10 text-white font-black text-xl italic tracking-tighter">
          {config.icon}
        </div>

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-[14px] pointer-events-none">
          <div className="absolute top-[-50%] left-[-100%] w-[200%] h-[200%] bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-45 transition-transform duration-1000 group-hover:translate-x-[50%] translate-x-[-50%]" />
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-baseline">
          <span className={`${brand === 'filmsnyarwanda' ? 'text-yellow-400' : 'text-white'} font-black text-2xl tracking-tighter transition-all duration-300`}>
            {config.name}
          </span>
          {brand !== 'filmsnyarwanda' && (
            <span className="text-gray-400 font-light text-2xl tracking-[0.1em] ml-1 transition-all duration-300 group-hover:text-white">
              {config.suffix}
            </span>
          )}
        </div>
        {brand === 'filmsnyarwanda' && (
          <span className="text-white font-black text-[10px] tracking-[0.4em] -mt-1">
            {config.suffix}
          </span>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <div className={`h-[1px] ${brand === 'filmsnyarwanda' ? 'w-full' : 'w-4'} ${config.accent} rounded-full`} />
          {brand !== 'filmsnyarwanda' && (
            <span className="text-[7px] font-black uppercase tracking-[0.4em] text-gray-600 transition-colors">
              {config.desc}
            </span>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Logo;
