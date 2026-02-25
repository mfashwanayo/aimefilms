
export enum ServiceCategory {
  GENERAL = 'General Entertainment',
  NICHE = 'Specialty & Niche',
  FAST = 'Free Ad-Supported (FAST)',
  ACTION = 'Action Vault',
  HORROR = 'Horror Vault',
  DOCUMENTARY = 'Documentary Node'
}

export type UserRole = 'admin' | 'user';
export type Language = 'EN' | 'RW' | 'FR' | 'SW' | 'ZH';

export interface UserPost {
  id: string;
  userEmail: string;
  imageUrl: string;
  timestamp: string;
  caption?: string;
}

export interface UserMessage {
  id: string;
  toEmail: string;
  fromName: string;
  subject: string;
  body: string;
  timestamp: string;
  isRead: boolean;
}

export interface User {
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  isVerified?: boolean;
  canDownload?: boolean; 
  password?: string;
  language?: Language;
  isBlocked?: boolean;
  joinedAt?: string;
}

export interface LogEntry {
  id: string;
  type: 'VIEW' | 'LOGIN' | 'REGISTER' | 'UPLOAD' | 'DELETE' | 'BLOCK' | 'MESSAGE';
  details: string;
  userEmail?: string;
  timestamp: string;
}

export type Brand = 'aimefilms' | 'tntfilms' | 'princefilms';

export interface StreamingService {
  id: string;
  name: string;
  brand: Brand;
  category: string; 
  section: 'kinyarwanda' | 'rwanda' | 'english';
  isHidden?: boolean;
  description: string;
  highlights: string[];
  pros: string[];
  imageUrl: string;
  logoUrl: string;
  link: string;
  videoUrl: string; 
  fullMovieUrl: string; 
  rating: string;
  year: string;
  duration: string;
  cast: string[];
  synopsis: string;
  isTrending?: boolean;
  isNew?: boolean;
  genre: string[];
  matchScore: number;
  price?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RecommendationRequest {
  mood: string;
  interests: string[];
  budget: 'free' | 'subscription' | 'any';
}
