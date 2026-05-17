/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Send, 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Sparkles,
  ArrowRight,
  BrainCircuit,
  MessageCircleQuestion,
  History,
  MessageSquare,
  Star,
  GraduationCap,
  LayoutGrid
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { Logo } from './components/Logo';
import { getSocraticTutorResponse } from './lib/gemini';
import { Message, ProblemStep } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  OperationType,
  handleFirestoreError,
  query,
  orderBy,
  limit,
  onSnapshot,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from './lib/firebase';

export type Page = 'home' | 'tutor' | 'streaks' | 'library' | 'auth' | 'contact' | 'reviews';
export type AuthMode = 'login' | 'signup';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('home');
  const [user, setUser] = useState<{ uid: string; email: string | null; displayName: string | null; username: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [problemImage, setProblemImage] = useState<string | null>(null);
  const [problemMimeType, setProblemMimeType] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [currentSteps, setCurrentSteps] = useState<ProblemStep[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('Hinglish');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('last_user_id');
    if (savedEmail) {
      setRememberedEmail(savedEmail);
      setAuthForm(prev => ({ ...prev, email: savedEmail }));
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let username = firebaseUser.displayName || 'Learner';
        
        // Try to get extended profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            username = userDoc.data().username || username;
          }
        } catch (e) {
          console.error("Profile fetch error:", e);
        }

        setUser({ 
          uid: firebaseUser.uid, 
          email: firebaseUser.email, 
          displayName: firebaseUser.displayName,
          username
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Check if user doc exists, if not create one
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          username: result.user.displayName || 'Learner',
          createdAt: serverTimestamp()
        });
      }
      setActivePage('home');
    } catch (error: any) {
      setAuthError(error.message || 'Google sign-in failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
    setAuthError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      if (authMode === 'signup') {
        if (authForm.username.length < 3) {
           setAuthError('Username must be at least 3 characters.');
           setIsAuthLoading(false);
           return;
        }
        
        const credentials = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        await updateProfile(credentials.user, { displayName: authForm.username });
        
        // Save to Firestore for cross-device username retrieval
        await setDoc(doc(db, 'users', credentials.user.uid), {
          uid: credentials.user.uid,
          email: authForm.email,
          username: authForm.username,
          createdAt: serverTimestamp()
        });

        localStorage.setItem('last_user_id', authForm.email);
        setActivePage('home');
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        localStorage.setItem('last_user_id', authForm.email);
        setActivePage('home');
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password provider is not enabled in Firebase Console.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('Invalid credentials. Please check your email and password.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already in use.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Password is too weak. (Min 6 characters)');
      } else {
        setAuthError(error.message || 'Authentication failed.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActivePage('auth');
  };

  const renderAuth = () => (
    <div className="flex-1 flex items-center justify-center p-8 z-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-sky-400"></div>
        <div className="text-center mb-8">
          <Logo size="lg" className="mx-auto mb-6" />
          <h2 className="text-3xl font-serif italic mb-2">
            {authMode === 'login' ? 'Scholar Login' : 'Initial Registration'}
          </h2>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">
            {authMode === 'login' ? 'Resuming Scientific Inquiry' : 'Establishing User Protocol'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {authMode === 'signup' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 ml-4">Subject Name</label>
              <input 
                required
                value={authForm.username}
                onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="e.g. VigyanSeeker"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10"
              />
            </motion.div>
          )}
          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 ml-4">Identifier (Email)</label>
            <input 
              required
              type="email"
              value={authForm.email}
              onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="scholar@vidyapeeth.edu"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-2 ml-4">Heuristic Key (Password)</label>
            <input 
              required
              type="password"
              value={authForm.password}
              onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Required: 6+ characters"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10"
            />
          </div>
          
          {authError && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <p className="text-red-400 text-[10px] font-bold text-center leading-relaxed">
                {authError}
              </p>
            </motion.div>
          )}

          <button 
            type="submit" 
            disabled={isAuthLoading}
            className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold text-sm tracking-tight hover:bg-violet-500 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-violet-600/20 uppercase tracking-widest disabled:opacity-50"
          >
            {isAuthLoading ? 'Connecting...' : (authMode === 'login' ? 'Resume Session' : 'Begin Journey')}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-white/10"></div>
          <span className="text-[10px] text-white/20 uppercase tracking-widest font-black">or utilize oauth</span>
          <div className="h-[1px] flex-1 bg-white/10"></div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={isAuthLoading}
          className="w-full mt-6 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-sm tracking-tighter hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          {isAuthLoading ? 'SYSCALL ACTIVE...' : 'ENGAGE WITH GOOGLE'}
        </button>

        <div className="mt-8 text-center">
          <button 
            onClick={toggleAuthMode}
            className="text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white transition-colors py-2 px-4 border border-white/5 rounded-full hover:bg-white/5 active:scale-95"
          >
            {authMode === 'login' ? 'New Scholar? Create Account' : 'Existing Peer? Scholar Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setProblemImage(base64);
        setProblemMimeType(file.type);
        startSocraticSession(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const startSocraticSession = async (base64?: string, mimeType?: string, text?: string) => {
    setActivePage('tutor');
    setIsAnalyzing(true);
    
    const promptText = text || "I need help with this problem. Please guide me step-by-step using the Socratic method.";
    const initialMessage: Message = {
      role: 'user',
      parts: [{ text: promptText }]
    };
    
    try {
      const imageData = base64 && mimeType ? { data: base64, mimeType } : undefined;
      const response = await getSocraticTutorResponse([initialMessage], imageData, selectedLanguage);
      setMessages([
        initialMessage,
        { role: 'model', parts: [{ text: response.text || "I see your challenge. Let's explore this together." }] }
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim() || isAnalyzing) return;

    const userMessage: Message = { role: 'user', parts: [{ text: textToSend }] };
    setMessages(prev => [...prev, userMessage]);
    if (!overrideText) setInputText('');
    setIsAnalyzing(true);

    try {
      const chatHistory = [...messages, userMessage];
      const response = await getSocraticTutorResponse(chatHistory, undefined, selectedLanguage);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: response.text || "" }] }]);
      
      if (response.text?.toLowerCase().includes("correct") || response.text?.toLowerCase().includes("exactly")) {
        setCurrentSteps(prev => {
          const next = [...prev];
          const firstUncompleted = next.findIndex(s => !s.completed);
          if (firstUncompleted !== -1) {
            next[firstUncompleted].completed = true;
            if (next.every(s => s.completed)) {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
          }
          return next;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderNavigation = () => (
    <nav className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-full md:rounded-[2.5rem] px-2 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-6 z-50 shadow-2xl ring-1 ring-white/5">
      {[
        { id: 'home', icon: LayoutGrid, label: 'Hub' },
        { id: 'tutor', icon: Sparkles, label: 'Tutor' },
        { id: 'streaks', icon: BrainCircuit, label: 'Collective' },
        { id: 'library', icon: History, label: 'Vault' },
        { id: 'reviews', icon: Star, label: 'Reviews' },
        { id: 'contact', icon: MessageSquare, label: 'Contact' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActivePage(item.id as Page)}
          className={`flex items-center gap-2 md:gap-3 px-3 py-3 md:px-6 md:py-3 rounded-full md:rounded-2xl font-bold text-[10px] tracking-widest transition-all duration-300 uppercase ${
            activePage === item.id 
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' 
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <item.icon className="w-4 h-4" />
          <span className={activePage === item.id ? 'block' : 'hidden md:block'}>{item.label}</span>
        </button>
      ))}
    </nav>
  );

  const renderHome = () => (
    <div className="flex-1 overflow-y-auto px-8 py-12 flex flex-col gap-12 custom-scrollbar">
      <div className="max-w-screen-xl mx-auto w-full text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-5xl md:text-6xl font-serif italic mb-6 tracking-tight">Wisdom Begins in Wonder.</h2>
          <p className="text-white/40 text-sm uppercase tracking-[0.4em] font-medium mb-12">Engineering Architect Core • Project Hub</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { label: 'Type Question', icon: Send, color: 'violet', desc: 'Consult the AI instantly' },
            { label: 'Upload Document', icon: Upload, color: 'sky', desc: 'PDFs, Docs, or Images' },
            { label: 'Snap History', icon: Camera, color: 'amber', desc: 'Visual OCR Analysis' }
          ].map((item, idx) => (
            <div 
              key={idx}
              className="bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 p-8 flex flex-col items-center group hover:bg-white/10 transition-all cursor-pointer hover:-translate-y-2"
            >
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <item.icon className="w-8 h-8 text-white/60 group-hover:text-violet-400 transition-colors" />
              </div>
              <h3 className="text-xl font-bold mb-2">{item.label}</h3>
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-black mb-6">{item.desc}</p>
              {item.label === 'Type Question' ? (
                <div className="w-full relative">
                  <input 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:border-violet-500/50 outline-none placeholder:text-white/20"
                    placeholder="Ask anything..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') startSocraticSession(undefined, undefined, (e.target as HTMLInputElement).value);
                    }}
                  />
                  <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                </div>
              ) : (
                <label className="w-full cursor-pointer">
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                  <div className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-center">
                    Select File
                  </div>
                </label>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 rounded-[3rem] p-12 border border-white/10 relative overflow-hidden text-left group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2 group-hover:bg-white/10 transition-colors"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <span className="inline-block px-4 py-1.5 rounded-full bg-violet-600/30 border border-violet-400/30 text-[10px] font-black uppercase tracking-widest mb-6">Heuristic Roadmap</span>
              <h3 className="text-3xl font-bold mb-4 tracking-tight leading-tight">Master Complex Projects without Shortcuts.</h3>
              <p className="text-white/50 leading-relaxed mb-8">Vigyan Guru uses deep reasoning to identify exactly where your logic breaks, guiding you back to clarity without ever giving the answer away.</p>
              <button 
                onClick={() => setActivePage('streaks')}
                className="px-8 py-4 bg-white text-black rounded-2xl font-bold text-sm tracking-tight hover:scale-105 transition-transform"
              >
                JOIN THE STUDY CLUB
              </button>
            </div>
            <div className="w-16 h-16 bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/20 flex flex-col items-center justify-center shadow-2xl">
              <Sparkles className="w-6 h-6 text-amber-400 mb-1" />
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStreaks = () => (
    <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-screen-2xl mx-auto w-full z-10 overflow-y-auto">
      <div className="lg:col-span-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-serif italic">Study Hub</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-black italic">Collaborative Heuristics • Global Server</p>
          </div>
          <button className="px-6 py-3 bg-violet-600 font-bold text-sm rounded-2xl shadow-lg shadow-violet-600/20">
            CREATE ROOM
          </button>
        </header>

        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-12 text-center relative overflow-hidden">
          <div className="w-56 h-56 mx-auto mb-8 relative flex items-center justify-center">
             <div className="absolute w-full h-full bg-violet-600/20 rounded-full blur-3xl animate-pulse"></div>
             <div className="w-40 h-40 bg-gradient-to-t from-violet-600 to-sky-400 rounded-full flex flex-col items-center justify-center shadow-2xl ring-4 ring-white/10">
                <BrainCircuit className="w-20 h-20 text-white" />
             </div>
          </div>
          <h3 className="text-3xl font-serif italic mb-2 tracking-tight">Nimbus the Cloud Spirit</h3>
          <p className="text-violet-300/80 text-[10px] tracking-[0.3em] font-black uppercase mb-8">Guardian of Heuristics • Level 18</p>
          <div className="flex gap-4 justify-center">
            <div className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10">
               <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Room Vibe</p>
               <p className="text-xl font-bold italic">Focus Mode 🧘</p>
            </div>
            <div className="px-8 py-4 rounded-3xl bg-white/5 border border-white/10 text-sky-400">
               <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Group Focus</p>
               <p className="text-xl font-bold">142% ⚡</p>
            </div>
          </div>
        </section>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6">
           <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6">Active Squad (4)</h3>
           <div className="space-y-4">
              {[
                { name: 'Jordan D.', status: 'Studying', color: 'blue' },
                { name: 'Sarah M.', status: 'Idle', color: 'pink', idle: true },
                { name: 'Tyler K.', status: 'Studying', color: 'indigo' },
                { name: 'You', status: '23:14 left', color: 'violet', active: true }
              ].map((member, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${member.active ? 'bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20' : 'bg-white/5 border-white/10 opacity-70'}`}>
                  <div className="w-10 h-10 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center font-bold text-xs">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className={`text-[10px] uppercase font-black tracking-widest ${member.idle ? 'text-white/30' : 'text-green-400'}`}>{member.status}</p>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );

  const renderLibrary = () => (
    <div className="flex-1 p-8 max-w-screen-2xl mx-auto w-full z-10 space-y-12 overflow-y-auto">
      <header>
        <h2 className="text-5xl font-serif italic mb-2 tracking-tight">Wisdom Repository</h2>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.5em] font-black">History of Logic • Self-Owned Encryption</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex gap-6 group hover:bg-white/10 transition-all cursor-pointer">
            <div className="w-20 h-20 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center shrink-0">
               <BookOpen className="w-8 h-8 text-white/20" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1 block">Mathematics • Analysis</span>
              <h4 className="text-lg font-bold mb-2 group-hover:text-violet-300 transition-colors">Investigation 0{i}</h4>
              <p className="text-xs text-white/30 leading-relaxed italic mb-4">"Exploring the relationship between derivative volume and constant surface ratio..."</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">May 15, 2026</span>
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest px-3 py-1 bg-green-400/10 rounded-full">Completed</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTutor = () => (
    <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 overflow-hidden z-10 relative">
      <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar order-2 lg:order-1">
        <section className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 ring-1 ring-white/5">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-violet-600/10 rounded-2xl flex items-center justify-center text-violet-400 border border-violet-500/20">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white tracking-tight">Socratic Session</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Guided Learning</p>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed italic px-2">
              Asking questions is the first step toward knowledge. Describe your science project or problem to begin.
            </p>
            <div className="pt-4 border-t border-white/5">
              <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 px-2">Learning Tips</h4>
              <ul className="space-y-3 px-2">
                <li className="flex gap-3 text-xs text-white/40">
                  <div className="w-1 h-1 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                  <span>Be specific about what you're trying to build.</span>
                </li>
                <li className="flex gap-3 text-xs text-white/40">
                  <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>Mention the materials you have available.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white/5 backdrop-blur-sm rounded-3xl p-5 border border-white/10 flex-1 min-h-[300px] flex flex-col overflow-hidden relative group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" />
              Vision Sensor
            </h3>
          </div>
          
          <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 relative bg-[#050508]">
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                {problemImage ? (
                  <img 
                    src={`data:${problemMimeType};base64,${problemImage}`} 
                    alt="Problem" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:border-violet-500/50 group-hover:bg-violet-500/5 shadow-2xl shadow-black">
                      <Upload className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-sm font-bold text-white/90">Drop Project Image</p>
                    <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest text-center">Neural Scan Compatible</p>
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleFileUpload}
                      accept="image/*"
                    />
                  </div>
                )}
                {problemImage && (
                  <button 
                    onClick={() => {
                      setProblemImage(null);
                      setMessages([]);
                      setCurrentSteps([]);
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-red-500/10 border border-red-500/30 backdrop-blur rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
          </div>
        </section>
      </div>

      <div className="lg:col-span-8 flex flex-col bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden relative ring-1 ring-white/5 order-1 lg:order-2 h-[600px] lg:h-full">
        <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-11 h-11 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center text-violet-400 shadow-lg shadow-violet-600/10">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#020205] rounded-full shadow-[0_0_8px_#22c55e]"></div>
            </div>
            <div>
              <h2 className="font-bold text-white tracking-tight">Vigyan Guru</h2>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></span>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Heuristic Session Active</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-bold text-white/60 outline-none focus:border-violet-500/50 transition-all appearance-none cursor-pointer hover:bg-white/10"
            >
              {[
                'Hinglish', 'Hindi', 'English', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi'
              ].map(lang => (
                <option key={lang} value={lang} className="bg-[#050510] text-white">{lang}</option>
              ))}
            </select>
            <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <History className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[80px] pointer-events-none"></div>
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-white/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl">
                  <MessageCircleQuestion className="w-12 h-12 text-violet-300" />
                </div>
                <h3 className="text-4xl font-serif italic text-white mb-4 tracking-tight leading-tight">Mastery through Discovery.</h3>
                <p className="text-white/40 max-w-sm mx-auto leading-relaxed text-sm uppercase tracking-widest font-medium">
                  Initialize your project sensor to begin mapping the mechanics.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-[2rem] shadow-2xl ${
                    msg.role === 'user' 
                      ? 'bg-violet-600 text-white px-6 py-4 rounded-tr-none border border-violet-400/30' 
                      : 'bg-white/5 backdrop-blur-md text-white/90 px-8 py-6 rounded-tl-none font-serif text-[18px] leading-relaxed border border-white/10'
                  }`}>
                    <div className="markdown-body">
                      <ReactMarkdown>
                        {msg.parts[0].text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white/5 backdrop-blur-md rounded-[2rem] rounded-tl-none px-6 py-4 flex items-center gap-3 border border-white/10 shadow-xl">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></div>
                </div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Architect is analyzing mechanics...</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-8 border-t border-white/10 bg-[#050510]/50 backdrop-blur-2xl">
          <div className="flex gap-4 items-end">
            <div className="flex-1 relative group">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="w-full pl-6 pr-16 py-4.5 bg-white/5 border border-white/10 rounded-3xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all resize-none max-h-40 min-h-[64px] text-white placeholder-white/20 shadow-inner outline-none"
                placeholder={problemImage || messages.length > 0 ? "Describe the next project milestone..." : "What project are you building today?"}
                disabled={isAnalyzing}
              />
              <button 
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isAnalyzing}
                className="absolute right-3.5 bottom-3.5 w-11 h-11 bg-violet-600 text-white rounded-2xl shadow-xl hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/10 transition-all flex items-center justify-center group/btn active:scale-90"
              >
                <Send className="w-5 h-5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
             <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
             <p className="text-[9px] text-white/20 text-center uppercase tracking-[0.4em] font-black">
               Vigyan Guru • Master of Heuristics
             </p>
             <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
        </div>
      </div>
    </main>
  );

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingContact(true);
    
    const formData = new FormData(e.currentTarget);
    const contactData = {
      uid: user?.uid || 'anonymous',
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
      createdAt: serverTimestamp()
    };
    
    try {
      // Save to Firestore
      await addDoc(collection(db, 'messages'), contactData);

      // Optional: still send to Formspree for email notification
      await fetch("https://formspree.io/f/xbdwnjpb", {
        method: "POST",
        body: formData,
        headers: { 'Accept': 'application/json' }
      });
      
      setContactSubmitted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#c084fc', '#ffffff']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
      alert("Transmission failed. Please try again later.");
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentReviews(reviewsData);
    });
    return () => unsubscribe();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (reviewRating === 0) {
      alert("Please select a rating before transmitting.");
      return;
    }
    setIsSubmittingReview(true);
    
    const formData = new FormData(e.currentTarget);
    const author = formData.get('author') as string;
    const reviewText = formData.get('review') as string;

    const reviewData = {
      uid: user?.uid || 'anonymous',
      author: author || user?.username || 'Anonymous Scholar',
      rating: reviewRating,
      review: reviewText,
      createdAt: serverTimestamp()
    };
    
    try {
      await addDoc(collection(db, 'reviews'), reviewData);

      // Also send to Formspree for email notification
      const formPayload = new FormData();
      formPayload.append('author', author);
      formPayload.append('rating', reviewRating.toString());
      formPayload.append('review', reviewText);
      await fetch("https://formspree.io/f/xbdwnjpb", {
        method: "POST",
        body: formPayload,
        headers: { 'Accept': 'application/json' }
      });

      setReviewSubmitted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#ffffff']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
      alert("Review transmission failed.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const renderReviews = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 via-transparent to-violet-600/5 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10 my-8"
      >
        {reviewSubmitted ? (
          <div className="text-center py-12">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
            >
              <Star className="w-10 h-10 text-amber-400 fill-amber-400" />
            </motion.div>
            <h2 className="text-3xl font-serif italic text-white mb-4">Feedback Captured.</h2>
            <p className="text-white/60 leading-relaxed max-w-sm mx-auto mb-8">
              Your insight has been transmitted to the Architects. Your review helps us refine the heuristic systems.
            </p>
            <button 
              onClick={() => {
                setReviewSubmitted(false);
                setReviewRating(0);
                setActivePage('home');
              }}
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
            >
              Return to Hub
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-amber-600/20 rounded-3xl border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
                <Star className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-3xl font-serif italic text-white mb-2">Rate the Architecture</h2>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">
                Review Sensor Online
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest text-center">Quality Assessment</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="group relative p-2 transition-all active:scale-95"
                    >
                      <Star 
                        className={`w-8 h-8 transition-all ${
                          star <= reviewRating 
                            ? 'text-amber-400 fill-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                            : 'text-white/10 group-hover:text-white/30'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Identifier (Name/Email)</label>
                  <input 
                    type="text"
                    name="author"
                    required
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none"
                    placeholder="Anonymous Scholar"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Expert Testimony</label>
                  <textarea 
                    name="review"
                    required
                    rows={4}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none resize-none"
                    placeholder="Share your thoughts on the Vigyan Guru experience..."
                  ></textarea>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmittingReview}
                className="w-full py-5 bg-amber-600 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl shadow-amber-600/20 hover:bg-amber-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingReview ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Transmitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </form>

            <div className="mt-12 pt-12 border-t border-white/10">
              <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 text-center">Community Testimonials</h3>
              <div className="space-y-4">
                {recentReviews.length > 0 ? (
                  recentReviews.map((rev) => (
                    <motion.div 
                      key={rev.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-violet-300">{rev.author}</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-2.5 h-2.5 ${i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed italic">"{rev.review}"</p>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-[10px] text-white/20 text-center italic">No expert testimonies yet. Be the first.</p>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );

  const renderContact = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-amber-600/5 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10 my-8"
      >
        {contactSubmitted ? (
          <div className="text-center py-12">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
            >
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="text-3xl font-serif italic text-white mb-4">Inquiry Received.</h2>
            <p className="text-white/60 leading-relaxed max-w-sm mx-auto mb-8">
              The Engineering Team has received your transmission. Our architects will contact you shortly to discuss your project.
            </p>
            <button 
              onClick={() => {
                setContactSubmitted(false);
                setActivePage('home');
              }}
              className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
            >
              Return to Hub
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-violet-600/20 rounded-3xl border border-violet-500/30 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-3xl font-serif italic text-white mb-2">Connect with the Architect</h2>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">
                Inquiry Sensor Initialized
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Full Name</label>
                  <input 
                    type="text"
                    name="name"
                    required
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none"
                    placeholder="Arya Sharma"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Vidyalaya / Email</label>
                  <input 
                    type="email"
                    name="email"
                    required
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none"
                    placeholder="student@vidyalaya.in"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Subject</label>
                <input 
                  type="text"
                  name="subject"
                  required
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none"
                  placeholder="Project Collaboration Inquiry"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest ml-4">Message</label>
                <textarea 
                  name="message"
                  required
                  rows={4}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all text-white placeholder-white/20 outline-none resize-none"
                  placeholder="Tell the Architect about your project idea..."
                ></textarea>
              </div>

              <button 
                type="submit"
                disabled={isSubmittingContact}
                className="w-full py-5 bg-violet-600 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingContact ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Transmitting...
                  </>
                ) : (
                  'Transmit Inquiry'
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-[9px] text-white/20 uppercase tracking-widest">Powered by Formspree Relay</p>
              <div className="flex gap-4">
                <div className="h-1 w-1 bg-violet-500 rounded-full animate-pulse"></div>
                <div className="h-1 w-1 bg-amber-500 rounded-full animate-pulse [animation-delay:-0.5s]"></div>
                <div className="h-1 w-1 bg-blue-500 rounded-full animate-pulse [animation-delay:-1s]"></div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
  return (
    <div className="h-[100dvh] bg-[#020205] text-white font-sans selection:bg-violet-500/30 selection:text-white relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-900/10 blur-[120px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-900/15 blur-[100px]"></div>
      </div>

      <header className="h-20 flex items-center justify-between px-8 border-b border-white/10 backdrop-blur-md bg-white/5 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActivePage('home')}>
          <Logo size="sm" />
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase">Vigyan Guru</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Science Guru • Project Guide</p>
          </div>
        </div>
          <div className="flex gap-6 items-center">
            {user ? (
              <div className="flex gap-4 items-center">
                <div className="bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-violet-400 fill-violet-400" />
                  </div>
                  <span className="text-violet-300 text-sm font-bold flex items-center gap-1.5 uppercase tracking-tighter">
                    {user.username}
                  </span>
                  <div className="h-4 w-[1px] bg-white/10"></div>
                  <span className="text-sky-400 text-sm font-bold">Heuristic Level 1</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors"
                >
                  <History className="w-5 h-5 rotate-180" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setActivePage('auth')}
                className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-violet-600/20"
              >
                SIGN IN
              </button>
            )}
          </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activePage === 'auth' && renderAuth()}
        {activePage === 'home' && renderHome()}
        {activePage === 'tutor' && (user ? renderTutor() : renderAuth())}
        {activePage === 'streaks' && (user ? renderStreaks() : renderAuth())}
        {activePage === 'library' && (user ? renderLibrary() : renderAuth())}
        {activePage === 'reviews' && renderReviews()}
        {activePage === 'contact' && renderContact()}
      </div>

      {user && renderNavigation()}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
}
