
import React, { useState, useRef, useEffect } from 'react';
import { getAIStudioResponse } from '../services/geminiService';
import { StreamingService, Language, User, ChatMessage, Brand } from '../types';
import { AimeFilmsAPI, MASTER_ADMIN_CREDENTIALS } from '../services/api';

interface AIStudioProps {
  onSelectService: (service: StreamingService) => void;
  onExecuteAction: (action: { type: string, value: string }) => void;
  onClose: () => void;
  onLogin: (user: User) => void;
  language: Language;
  user: User | null;
  initialPrompt?: string;
  currentMovie?: StreamingService | null;
  allMovies: StreamingService[];
  brand: Brand;
}

const AIStudio: React.FC<AIStudioProps> = ({ onSelectService, onExecuteAction, onClose, onLogin, language, user, initialPrompt, currentMovie, allMovies, brand }) => {
  const [instruction, setInstruction] = useState(initialPrompt || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [adminUserList, setAdminUserList] = useState<User[]>([]);
  const [targetDocument, setTargetDocument] = useState<any>(null);
  
  const [pwChangeState, setPwChangeState] = useState<'idle' | 'verifying' | 'setting_new'>('idle');

  const scrollRef = useRef<HTMLDivElement>(null);

  const brandColors = {
    aimefilms: { bg: 'bg-red-600', shadow: 'shadow-[0_0_50px_rgba(220,38,38,0.15)]', text: 'text-red-600' },
    filmsnyarwanda: { bg: 'bg-blue-600', shadow: 'shadow-[0_0_50px_rgba(59,130,246,0.15)]', text: 'text-blue-600' },
    princefilms: { bg: 'bg-purple-600', shadow: 'shadow-[0_0_50px_rgba(168,85,247,0.15)]', text: 'text-purple-600' }
  };

  const currentBrand = brandColors[brand];

  useEffect(() => {
    if (initialPrompt) {
      const timer = setTimeout(() => {
        const form = document.getElementById('ai-studio-form') as HTMLFormElement;
        form?.requestSubmit();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isProcessing, pwChangeState, adminUserList, targetDocument]);

  const handleStudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isProcessing) return;

    const userMsg = instruction.trim();
    setIsProcessing(true);
    setInstruction('');
    
    // Add user message to history immediately
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);

    const response = await getAIStudioResponse(
      userMsg, 
      language, 
      !!user, 
      currentMovie?.name,
      user?.role,
      allMovies,
      chatHistory
    );
    
    setAdminUserList([]);
    setTargetDocument(null);

    if (response.action?.type === 'ADMIN_AUTH_SUCCESS') {
      const adminUser: User = {
        name: MASTER_ADMIN_CREDENTIALS.name,
        email: MASTER_ADMIN_CREDENTIALS.email,
        role: 'admin',
        isVerified: true
      };
      onLogin(adminUser);
    }

    if (response.action?.type === 'ADMIN_VIEW_USERS' && user?.role === 'admin') {
      const users = await AimeFilmsAPI.getAllUsers();
      setAdminUserList(users);
    }

    // Add model response to history
    setChatHistory(prev => [...prev, { role: 'model', text: response.narrative }]);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-0 md:p-4 lg:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/95 md:bg-black/80 backdrop-blur-xl" onClick={onClose} />
      
      <div className={`relative bg-[#080808] w-full max-w-md h-[60vh] md:h-[500px] md:rounded-[2rem] border md:border border-white/10 ${currentBrand.shadow} flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-500 md:fixed md:bottom-8 md:right-8`}>
        
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-white/5 bg-black/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 ${user?.role === 'admin' ? 'bg-blue-600' : currentBrand.bg} rounded-lg flex items-center justify-center shadow-lg`}>
               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m4.93 4.93 14.14 14.14"/><path d="M2 12h20"/></svg>
            </div>
            <div>
              <h2 className="text-xs font-black tracking-tighter uppercase italic text-white leading-none">AimeFilms AI</h2>
              <p className="text-[6px] text-gray-500 font-black uppercase tracking-[0.2em] flex items-center gap-1 mt-0.5">
                <span className={`w-1 h-1 rounded-full ${user ? 'bg-green-500' : 'bg-gray-700'}`} />
                {user ? user.name : 'Guest'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-all text-gray-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Compact Feed Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gradient-to-b from-transparent to-white/[0.01]">
          
          {chatHistory.length === 0 && !isProcessing && (
            <div className="h-full flex flex-col items-center justify-center opacity-10 text-center space-y-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M12 2v20"/><path d="m4.93 4.93 14.14 14.14"/><path d="M2 12h20"/></svg>
              <p className="text-[6px] font-black uppercase tracking-[0.4em]">System Idle</p>
            </div>
          )}

          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`animate-in fade-in slide-in-from-bottom-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`${msg.role === 'user' ? 'bg-white/5 border-white/10 ml-8' : 'bg-white/[0.02] border-white/5 mr-8'} border p-3 rounded-xl shadow-sm max-w-[90%]`}>
                <p className={`text-xs font-medium text-white leading-relaxed tracking-tight ${msg.role === 'model' ? 'italic' : ''}`}>
                  {msg.text}
                </p>
              </div>
            </div>
          ))}

          {adminUserList.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden animate-in zoom-in-95">
              <table className="w-full text-left">
                <thead className="bg-black/50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminUserList.map(u => (
                    <tr key={u.email}>
                      <td className="px-6 py-4 font-bold">{u.name}</td>
                      <td className={`px-6 py-4 text-xs uppercase font-black ${currentBrand.text}`}>{u.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 animate-pulse pl-2">
               <div className={`w-1 h-1 rounded-full ${currentBrand.bg}`} />
               <div className={`w-1 h-1 rounded-full ${currentBrand.bg} delay-150`} />
               <span className="text-[7px] font-black text-gray-700 uppercase tracking-widest ml-2">Synchronizing Nodes...</span>
            </div>
          )}
        </div>

        {/* Compact & Mobile-Friendly Input */}
        <div className="px-5 py-4 md:px-8 md:py-6 bg-black/90 md:bg-black/60 border-t border-white/5 backdrop-blur-xl shrink-0">
          <form id="ai-studio-form" onSubmit={handleStudioSubmit} className="relative group max-w-3xl mx-auto">
            <input 
              value={instruction} 
              onChange={(e) => setInstruction(e.target.value)} 
              placeholder="Ask AimeFilms AI..." 
              disabled={isProcessing} 
              className={`w-full bg-[#0c0c0c] text-white px-5 py-3.5 md:px-6 md:py-4 rounded-xl md:rounded-2xl border border-white/10 focus:border-${currentBrand.text.replace('text-', '')} focus:outline-none pr-12 text-sm md:text-base font-bold transition-all disabled:opacity-50`} 
            />
            <button type="submit" disabled={isProcessing || !instruction.trim()} className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${currentBrand.bg} text-white p-2 rounded-lg md:rounded-xl transition-all active:scale-90`}>
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="md:w-5 md:h-5"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          </form>
          <div className="flex justify-center items-center gap-3 mt-3 md:mt-4 opacity-30">
             <div className="h-px bg-white/10 flex-1" />
             <p className="text-[6px] md:text-[7px] font-black text-white uppercase tracking-[0.3em]">Direct Relay Link</p>
             <div className="h-px bg-white/10 flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIStudio;
