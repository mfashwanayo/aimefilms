
import React, { useEffect, useRef, useState } from 'react';
import { StreamingService } from '../types';
import { STREAMING_SERVICES } from '../constants';
import { AimeFilmsAPI } from '../services/api';

interface VideoPlayerProps {
  url: string;
  title: string;
  onClose: () => void;
  isFullMovie?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, onClose, isFullMovie = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [previewPos, setPreviewPos] = useState<{ x: number, time: string, percent: number } | null>(null);
  
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const controlsTimeout = useRef<any>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Track Intelligence View
    const movie = STREAMING_SERVICES.find(s => s.name === title);
    if (movie) AimeFilmsAPI.trackMovieView(movie.id);

    return () => { document.body.style.overflow = 'unset'; };
  }, [title]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!isQualityMenuOpen && !isFeedbackModalOpen) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMute = !isMuted;
      setIsMuted(newMute);
      videoRef.current.muted = newMute;
      if (!newMute && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const handleProgressBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(Math.max(0, x / rect.width), 1);
    const time = percent * videoRef.current.duration;
    
    if (previewVideoRef.current) previewVideoRef.current.currentTime = time;

    setPreviewPos({
      x: e.clientX,
      time: formatTime(time),
      percent: percent * 100
    });
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    videoRef.current.currentTime = percent * videoRef.current.duration;
  };

  const changeQuality = (quality: string) => {
    setIsQualityMenuOpen(false);
    if (quality === currentQuality) return;
    
    setIsSwitchingQuality(true);
    setCurrentQuality(quality);
    
    const currentTime = videoRef.current?.currentTime || 0;
    setTimeout(() => {
      setIsSwitchingQuality(false);
      if (videoRef.current) videoRef.current.currentTime = currentTime;
    }, 1200);
  };

  const submitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setTimeout(() => {
      setFeedbackSent(false);
      setIsFeedbackModalOpen(false);
      setFeedbackText('');
    }, 2000);
  };

  const qualities = ['Auto', '1080p', '720p', '480p', '360p'];
  const relatedMovies = STREAMING_SERVICES.filter(s => s.name !== title).slice(0, 8);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[400] bg-black overflow-y-auto no-scrollbar scroll-smooth"
      onMouseMove={handleMouseMove}
    >
      <div className="relative w-full h-screen bg-black flex flex-col sticky top-0 z-10 shrink-0 overflow-hidden">
        {isSwitchingQuality && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-black text-xs uppercase tracking-[0.3em]">Switching to {currentQuality}</p>
          </div>
        )}

        <video 
          ref={videoRef}
          src={url} 
          className={`w-full h-full object-contain cursor-pointer transition-opacity duration-700 ${isSwitchingQuality ? 'opacity-30' : 'opacity-100'}`}
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onClick={togglePlay}
        />

        <video ref={previewVideoRef} src={url} muted className="hidden" preload="auto" />

        <div className={`absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 transition-opacity duration-500 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-8 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-6">
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-1">Now Playing Asset Relay</p>
                <h2 className="text-2xl font-black drop-shadow-xl tracking-tighter uppercase italic">{title}</h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsFeedbackModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white border border-white/10 transition-all active:scale-95"
              >
                Feedback
              </button>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            {!isPlaying && !isSwitchingQuality && (
              <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 animate-in zoom-in-50 duration-200 pointer-events-none">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 w-full p-8 space-y-6 pointer-events-auto">
            {previewPos && (
              <div 
                className="absolute bottom-28 bg-black/90 border border-white/20 rounded-xl overflow-hidden shadow-2xl transition-all duration-75 pointer-events-none"
                style={{ left: `${previewPos.percent}%`, transform: 'translateX(-50%)', width: '200px', aspectRatio: '16/9' }}
              >
                <video src={url} className="w-full h-full object-cover opacity-80" ref={(el) => { if (el) el.currentTime = (previewPos.percent / 100) * (videoRef.current?.duration || 0); }} muted />
                <div className="absolute bottom-2 left-0 right-0 text-center font-black text-xs text-white tracking-widest">{previewPos.time}</div>
              </div>
            )}

            <div 
              ref={progressBarRef}
              onMouseMove={handleProgressBarHover}
              onMouseLeave={() => setPreviewPos(null)}
              onClick={handleProgressBarClick}
              className="relative h-1.5 w-full bg-white/20 rounded-full cursor-pointer group"
            >
              <div className="absolute h-full bg-red-600 rounded-full transition-all duration-100" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <button onClick={togglePlay} className="transition-all active:scale-90 text-white">
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
                
                <div className="flex items-center gap-3 group text-white">
                  <button onClick={toggleMute} className="hover:text-red-500 transition-colors">
                    {isMuted || volume === 0 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    )}
                  </button>
                  <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 h-8 flex items-center">
                    <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-full accent-red-600 h-1 cursor-pointer bg-white/20 rounded-full appearance-none" />
                  </div>
                </div>

                <div className="text-white font-black text-xs tracking-widest">
                  {formatTime(videoRef.current?.currentTime || 0)}
                  <span className="mx-2 text-white/30">/</span>
                  <span className="text-white/50">{formatTime(videoRef.current?.duration || 0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 relative">
                 <div className="relative">
                   <button 
                     onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
                     className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                   >
                     <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded">{currentQuality}</span>
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                   </button>
                   
                   {isQualityMenuOpen && (
                     <div className="absolute bottom-12 right-0 w-32 bg-[#141414] border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-3 border-b border-white/5 bg-black/40">
                          <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest">Quality</p>
                        </div>
                        <div className="py-1">
                          {qualities.map(q => (
                            <button 
                              key={q} 
                              onClick={() => changeQuality(q)}
                              className={`w-full text-left px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-colors ${currentQuality === q ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                     </div>
                   )}
                 </div>

                 <button className="text-white/60 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsFeedbackModalOpen(false)} />
          <div className="relative bg-[#141414] w-full max-w-lg rounded-3xl border border-white/10 p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            {feedbackSent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Feedback Received</h3>
                <p className="text-gray-400 text-sm font-medium">Intelligence stored in Administrative Registry.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-4xl font-black text-white tracking-tighter italic">Cinema Feedback</h3>
                  <button onClick={() => setIsFeedbackModalOpen(false)} className="text-gray-500 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
                <form onSubmit={submitFeedback} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Your Message</label>
                    <textarea 
                      required
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Share your thoughts on the relay quality or asset..."
                      className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-medium outline-none focus:border-red-600 transition-all resize-none placeholder:text-gray-600"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsFeedbackModalOpen(false)}
                      className="flex-1 py-5 rounded-2xl font-black text-sm uppercase tracking-widest text-gray-500 bg-white/5 hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20 active:scale-95 transition-all"
                    >
                      Dispatch
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
