
import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy',
      text: 'At AimeFilms, we value your privacy. We only collect minimal information necessary to provide you with the best streaming discovery experience. Your data is never sold to third parties and is protected using industry-standard encryption.'
    },
    terms: {
      title: 'Terms & Conditions',
      text: 'By using AimeFilms, you agree to our terms of service. Our platform is for discovery and entertainment purposes. We provide translations and streaming links to curated content. Please use the service responsibly and respect international copyright laws.'
    }
  };

  const selected = content[type];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative bg-[#141414] w-full max-w-lg rounded-3xl border border-white/10 p-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">{selected.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="space-y-6">
          <p className="text-gray-400 leading-relaxed text-lg font-medium">
            {selected.text}
          </p>
          <div className="pt-6 border-t border-white/5">
            <button 
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
