
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Language, Brand } from '../types';
import { AimeFilmsAPI, MASTER_ADMIN_CREDENTIALS } from '../services/api';
import { translations } from '../locales/translations';
import Logo from './Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'signin' | 'signup' | 'forgot';
  onLogin: (user: User) => void;
  language: Language;
  brand: Brand;
}

const VERIFICATION_EXPIRY_SECONDS = 60;

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode, onLogin, language, brand }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify' | 'forgot' | 'reset'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedOnScreenCode, setGeneratedOnScreenCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [knownAccounts, setKnownAccounts] = useState<User[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = translations[language].auth;
  const tc = translations[language].common;
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 500);
      const stored = localStorage.getItem('aimefilms_known_accounts');
      if (stored) setKnownAccounts(JSON.parse(stored));
    }
  }, [initialMode, isOpen]);

  const saveKnownAccount = (user: User, pass?: string) => {
    const stored = localStorage.getItem('aimefilms_known_accounts');
    let accounts: (User & { savedPass?: string })[] = stored ? JSON.parse(stored) : [];
    
    // Remove if already exists
    accounts = accounts.filter(a => a.email !== user.email);
    
    const accountToSave = { ...user, savedPass: rememberMe ? pass : undefined };
    accounts.unshift(accountToSave);
    
    const limited = accounts.slice(0, 3);
    localStorage.setItem('aimefilms_known_accounts', JSON.stringify(limited));
    setKnownAccounts(limited as User[]);
  };

  const handleQuickLogin = async (account: User & { savedPass?: string }) => {
    if (account.savedPass) {
      setIsSubmitting(true);
      const result = await AimeFilmsAPI.authenticateUser(account.email, account.savedPass);
      if (result.success && result.user) {
        saveKnownAccount(result.user, account.savedPass);
        setIsSuccess(true);
        setTimeout(() => {
          onLogin(result.user!);
          setIsSuccess(false);
          setIsSubmitting(false);
          onClose();
        }, 800);
      } else {
        setIdentifier(account.email);
        setPassword('');
        setError(t.sessionExpired || "Session expired, please enter password.");
        setIsSubmitting(false);
      }
    } else {
      setIdentifier(account.email);
      setTimeout(() => {
        const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        pwInput?.focus();
      }, 100);
    }
  };

  useEffect(() => {
    if ((mode === 'verify' || mode === 'reset') && timeLeft > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, timeLeft]);

  const validation = useMemo(() => {
    return {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      id: identifier.trim().length >= 3,
      password: password.length >= 6,
      confirm: password === confirmPassword && confirmPassword !== ''
    };
  }, [identifier, email, password, confirmPassword]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await AimeFilmsAPI.registerUser({ name: name.trim(), email: email.trim(), password });
    if (result.success) {
      setMode('signin');
      setIdentifier(email);
      setError(t.regSuccess);
    } else {
      setError(result.message);
    }
    setIsSubmitting(false);
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await AimeFilmsAPI.authenticateUser(identifier, password);
    if (result.success && result.user) {
      saveKnownAccount(result.user, password);
      setIsSuccess(true);
      setTimeout(() => {
        onLogin(result.user!);
        setIsSuccess(false);
        setIsSubmitting(false);
        onClose();
      }, 800);
    } else {
      setError(result.message || tc.error);
      setIsSubmitting(false);
    }
  };

  const brandBg = {
    aimefilms: 'bg-red-600 hover:bg-red-700',
    filmsnyarwanda: 'bg-blue-600 hover:bg-blue-700',
    princefilms: 'bg-purple-600 hover:bg-purple-700'
  };

  const brandBorder = {
    aimefilms: 'focus:border-red-600',
    filmsnyarwanda: 'focus:border-blue-600',
    princefilms: 'focus:border-purple-600'
  };

  const brandText = {
    aimefilms: 'text-red-500',
    filmsnyarwanda: 'text-blue-500',
    princefilms: 'text-purple-500'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={onClose} />
      <div className="relative bg-[#050505] w-full max-w-md p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center mb-6">
          <Logo size="md" className="mb-4" brand={brand} />
          <h2 className="text-2xl font-black uppercase italic text-white text-center">
            {mode === 'signin' ? t.signin : mode === 'signup' ? t.signup : mode === 'forgot' ? t.forgot : t.reset}
          </h2>
        </div>

        {isSuccess ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className={`w-16 h-16 ${brandBg[brand].split(' ')[0]} rounded-full flex items-center justify-center mb-8 shadow-2xl`}><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg></div>
            <p className="text-white font-black text-lg tracking-tight uppercase">{tc.success}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <div className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 ${brandText[brand]}`}>{error}</div>}

            {mode === 'signin' && (
              <div className="space-y-6">
                {knownAccounts.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-center">Komeza nka / Continue as:</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {knownAccounts.map(acc => (
                        <button 
                          key={acc.email} 
                          onClick={() => handleQuickLogin(acc)}
                          className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 p-2 pr-4 rounded-full transition-all group"
                        >
                          <div className={`w-8 h-8 rounded-full ${brandBg[brand].split(' ')[0]} flex items-center justify-center font-black text-xs`}>
                            {acc.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black text-white uppercase">{acc.name}</p>
                            <p className="text-[8px] text-gray-500 font-bold">{acc.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 py-2">
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[8px] font-black text-gray-700 uppercase">Cyangwa / Or</span>
                      <div className="h-px bg-white/5 flex-1" />
                    </div>
                  </div>
                )}

                <form onSubmit={handleSignin} className="space-y-4">
                  <input type="text" placeholder={language === 'RW' ? "Username cyangwa Email" : t.email} required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                  <input type="password" placeholder="••••••••" required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={password} onChange={(e) => setPassword(e.target.value)} />
                  
                  <div className="flex items-center gap-3 px-2">
                    <input 
                      type="checkbox" 
                      id="rememberMe" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded bg-white/5 border-white/10 text-red-600 focus:ring-0"
                    />
                    <label htmlFor="rememberMe" className="text-[10px] font-black text-gray-500 uppercase cursor-pointer select-none">
                      {language === 'RW' ? 'Nyibuka / Remember Me' : 'Remember Me'}
                    </label>
                  </div>

                  <button type="submit" disabled={isSubmitting} className={`w-full py-4 ${brandBg[brand]} text-white rounded-2xl font-black text-xs uppercase transition-all active:scale-95`}>
                    {isSubmitting ? tc.loading : t.enter}
                  </button>
                  <button type="button" onClick={() => setMode('forgot')} className="w-full text-[10px] font-black uppercase text-gray-500 hover:text-white">{t.forgotLink}</button>
                </form>
              </div>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <input type="text" placeholder={t.name} required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={name} onChange={(e) => setName(e.target.value)} />
                <input type="email" placeholder={t.email} required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={email} onChange={(e) => setEmail(e.target.value)} />
                <input type="password" placeholder={t.passkey} required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={password} onChange={(e) => setPassword(e.target.value)} />
                <input type="password" placeholder={t.confirm} required className={`w-full bg-white/5 text-white px-6 py-4 rounded-xl border border-white/5 ${brandBorder[brand]} outline-none font-bold`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <button type="submit" disabled={isSubmitting} className={`w-full py-4 ${brandBg[brand]} text-white rounded-2xl font-black text-xs uppercase active:scale-95`}>
                  {isSubmitting ? tc.loading : t.create}
                </button>
              </form>
            )}

            {(mode === 'signin' || mode === 'signup') && (
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-gray-600 text-[9px] font-black uppercase tracking-[0.3em]">
                  {mode === 'signin' ? t.noAcc : t.hasAcc}
                  <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className={`text-white hover:${brandText[brand]} ml-4 font-black`}>
                    {mode === 'signin' ? t.joinHere : t.signHere}
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
