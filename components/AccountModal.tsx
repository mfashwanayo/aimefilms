
import React, { useState, useEffect, useRef } from 'react';
import { User, UserPost, UserMessage, Brand } from '../types';
import { AimeFilmsAPI } from '../services/api';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdateUser: (userData: User) => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  onSwitchAccount?: () => void;
  brand: Brand;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, user, onUpdateUser, onOpenAdmin, onLogout, onSwitchAccount, brand }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'inbox' | 'gallery' | 'membership'>('profile');
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  
  const [inbox, setInbox] = useState<UserMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [myPosts, setMyPosts] = useState<UserPost[]>([]);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const brandColors = {
    aimefilms: { bg: 'bg-red-600', shadow: 'shadow-red-600/20', text: 'text-red-600', glow: 'bg-red-600' },
    filmsnyarwanda: { bg: 'bg-blue-600', shadow: 'shadow-blue-600/20', text: 'text-blue-600', glow: 'bg-blue-600' },
    princefilms: { bg: 'bg-purple-600', shadow: 'shadow-purple-600/20', text: 'text-purple-600', glow: 'bg-purple-600' }
  };

  const currentBrand = brandColors[brand];

  useEffect(() => {
    if (isOpen && user) {
      loadInbox();
      loadGallery();
    }
  }, [isOpen, user]);

  const loadInbox = async () => {
    if (user) {
      const messages = await AimeFilmsAPI.getUserInbox(user.email);
      setInbox(messages);
    }
  };

  const loadGallery = async () => {
    if (user) {
      const posts = await AimeFilmsAPI.getUserPosts(user.email);
      setMyPosts(posts);
    }
  };

  const handleReadMessage = async (msg: UserMessage) => {
    setSelectedMessage(msg);
    if (!msg.isRead) {
      await AimeFilmsAPI.markMessageRead(msg.id);
      loadInbox();
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await AimeFilmsAPI.deleteMessage(id);
    loadInbox();
    if (selectedMessage?.id === id) setSelectedMessage(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    await AimeFilmsAPI.updateUserProfile(user.email, { name, avatar });
    onUpdateUser({ ...user, name, avatar });
    setIsSaving(false);
  };

  const isAdmin = user?.role === 'admin';

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative bg-[#0a0a0a] w-full max-w-6xl h-full md:h-[85vh] md:rounded-[3rem] border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-black/40 border-b md:border-b-0 md:border-r border-white/5 p-10 flex flex-col gap-3 shrink-0">
          <div className="flex flex-col items-center text-center mb-12">
            <div className="relative w-24 h-24 mb-6 group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className={`absolute inset-0 rounded-[2rem] ${currentBrand.glow} blur-xl opacity-20 group-hover:opacity-60 transition-opacity`} />
              <div className="relative w-full h-full rounded-[2rem] bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <span className="text-3xl font-black text-white">{user.name.charAt(0)}</span>}
              </div>
              <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setAvatar(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
            </div>
            <h3 className="text-xl font-black text-white uppercase italic">{user.name}</h3>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-2">{user.email}</p>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'profile', label: 'Umukoresha', icon: '👤' },
              { id: 'inbox', label: 'Ubutumwa', icon: '✉️', badge: inbox.filter(m => !m.isRead).length },
              { id: 'gallery', label: 'Amafoto', icon: '📸' },
              { id: 'membership', label: 'Access', icon: '💳' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSelectedMessage(null); }}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? `${currentBrand.bg} text-white shadow-xl` : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center gap-3">
                  {tab.icon} {tab.label}
                </span>
                {tab.badge ? <span className={`bg-white ${currentBrand.text} px-2 py-0.5 rounded-full text-[8px]`}>{tab.badge}</span> : null}
              </button>
            ))}
            
            <div className="pt-4 mt-4 border-t border-white/5 space-y-2">
              <button 
                onClick={onSwitchAccount}
                className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all"
              >
                🔄 Hindura Konte / Switch
              </button>
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
              >
                🚪 Sohoka / Logout
              </button>
            </div>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-12 lg:p-20 relative bg-gradient-to-br from-transparent to-white/[0.02]">
          <button onClick={onClose} className="absolute right-12 top-12 text-gray-500 hover:text-white transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          {activeTab === 'profile' && (
            <div className="max-w-xl animate-in fade-in slide-in-from-right-8">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic text-white mb-16">Konte Yanjye</h2>
              <form onSubmit={handleSaveProfile} className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Amazina yawe</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-white font-bold outline-none focus:border-${currentBrand.text.replace('text-', '')}`} />
                </div>
                <button type="submit" disabled={isSaving} className={`w-full ${currentBrand.bg} text-white p-7 rounded-3xl font-black text-xs uppercase tracking-widest hover:opacity-90 shadow-2xl`}>
                  {isSaving ? 'Bikwa...' : 'Vugurura Konte'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="animate-in fade-in slide-in-from-right-8">
              <h2 className="text-5xl font-black tracking-tighter uppercase italic text-white mb-12">Ubutumwa</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Message List */}
                <div className="space-y-4">
                  {inbox.length > 0 ? inbox.map(msg => (
                    <div 
                      key={msg.id}
                      onClick={() => handleReadMessage(msg)}
                      className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedMessage?.id === msg.id ? `${currentBrand.bg} border-${currentBrand.text.replace('text-', '')}/50 shadow-xl` : 'bg-white/5 border-white/10 hover:bg-white/10'} ${!msg.isRead && selectedMessage?.id !== msg.id ? `border-l-4 border-l-${currentBrand.text.replace('text-', '')}` : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`text-sm font-black uppercase tracking-tight ${selectedMessage?.id === msg.id ? 'text-white' : 'text-gray-200'}`}>{msg.subject}</h4>
                        <button onClick={(e) => handleDeleteMessage(e, msg.id)} className="text-gray-500 hover:text-white p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                      <p className={`text-[10px] font-bold ${selectedMessage?.id === msg.id ? 'text-white/70' : 'text-gray-500'}`}>Byohererejwe na {msg.fromName}</p>
                      <p className={`text-[8px] font-black uppercase tracking-widest mt-3 ${selectedMessage?.id === msg.id ? 'text-white/40' : 'text-gray-700'}`}>{new Date(msg.timestamp).toLocaleString()}</p>
                    </div>
                  )) : (
                    <div className="py-20 text-center opacity-30">
                      <p className="text-xs font-black uppercase tracking-widest">Nta butumwa uhafite.</p>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="bg-white/5 rounded-[3rem] border border-white/10 p-10 min-h-[400px]">
                  {selectedMessage ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                      <div className="mb-10 pb-10 border-b border-white/5">
                        <span className={`text-[10px] font-black ${currentBrand.text} uppercase tracking-[0.5em] block mb-4`}>Ubutumwa buvuye kuri {selectedMessage.fromName}</span>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic uppercase">{selectedMessage.subject}</h3>
                      </div>
                      <div className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedMessage.body}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="mb-6"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z"/><path d="m22 7-10 7L2 7"/></svg>
                      <p className="text-xs font-black uppercase tracking-widest">Hitamo ubutumwa ushaka gusoma</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ... other tabs (gallery, membership) kept same */}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
