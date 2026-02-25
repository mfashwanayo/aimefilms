
import React, { useState } from 'react';
import { Language, User } from '../types';
import { AimeFilmsAPI } from '../services/api';
import Logo from './Logo';

interface ContactAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  language: Language;
}

const ContactAdminModal: React.FC<ContactAdminModalProps> = ({ isOpen, onClose, user, language }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Technical');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    
    // Simulate registry transmission
    const adminMessage = {
      from: user?.email || 'Guest Node',
      subject,
      category,
      message,
      timestamp: new Date().toISOString()
    };
    
    const currentInbox = JSON.parse(localStorage.getItem('aimefilms_admin_inbox') || '[]');
    currentInbox.unshift(adminMessage);
    localStorage.setItem('aimefilms_admin_inbox', JSON.stringify(currentInbox));

    setTimeout(() => {
      setIsSending(false);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        onClose();
        setSubject('');
        setMessage('');
      }, 2000);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 md:p-10">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={onClose} />
      
      <div className="relative bg-[#050505] w-full max-w-2xl p-10 md:p-14 rounded-[3rem] shadow-[0_0_120px_rgba(220,38,38,0.2)] border border-white/10 animate-in zoom-in-95 duration-300">
        
        <div className="flex flex-col items-center mb-12">
          <Logo size="lg" className="mb-6" />
          <h2 className="text-4xl font-black tracking-tighter uppercase italic text-white text-center">
            {language === 'RW' ? 'Vugana na Master Admin' : 'Contact Master Admin'}
          </h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3">Direct Administrative Relay</p>
        </div>

        {sent ? (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p className="text-white font-black text-xl tracking-tight">Intelligence Transmitted.</p>
            <p className="text-gray-500 text-xs mt-2 uppercase font-black tracking-widest">Master Admin hybert notified.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 appearance-none"
                >
                  <option className="bg-black">Technical Support</option>
                  <option className="bg-black">Content Request</option>
                  <option className="bg-black">Account Issue</option>
                  <option className="bg-black">Other Intelligence</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Subject</label>
                <input 
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Incamake..."
                  className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Detailed Message</label>
              <textarea 
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder={language === 'RW' ? "Andika ubutumwa bwawe hano..." : "Describe your request in detail..."}
                className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white font-bold outline-none focus:border-red-600 transition-all resize-none"
              />
            </div>

            <div className="pt-6">
              <button 
                type="submit" 
                disabled={isSending}
                className={`w-full py-6 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${isSending ? 'bg-gray-800 text-gray-500' : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20 active:scale-95'}`}
              >
                {isSending ? 'Transmitting...' : (language === 'RW' ? 'Ohereza Ubutumwa' : 'Dispatch Intelligence')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ContactAdminModal;
