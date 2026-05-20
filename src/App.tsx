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
  LayoutGrid,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Brain,
  RefreshCw,
  Trophy,
  X,
  HelpCircle,
  Sun,
  Moon,
  Users,
  Calendar,
  Mic,
  Volume2,
  Bell
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { Logo } from './components/Logo';
import { getSocraticTutorResponse, generateWeeklyQuestion, evaluateWeeklyTest } from './lib/gemini';
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
  updateProfile,
  firebaseConfig,
  deleteDoc
} from './lib/firebase';

export type Page = 'home' | 'tutor' | 'streaks' | 'library' | 'practice' | 'auth' | 'contact' | 'reviews';
export type AuthMode = 'login' | 'signup';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('home');
  const [user, setUser] = useState<{ uid: string; email: string | null; displayName: string | null; username: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
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
  const [showPassword, setShowPassword] = useState(false);

  // --- Quizzes and Flashcards Engine States ---
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [activePracticeTab, setActivePracticeTab] = useState<'quizzes' | 'flashcards' | 'tests' | 'groups'>('quizzes');
  
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number; answered: number; finished: boolean } | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  
  const [activeDeck, setActiveDeck] = useState<any | null>(null);
  const [currentCardIdx, setCurrentCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [deckScores, setDeckScores] = useState<{ mastered: number; review: number } | null>(null);
  
  // Creator Workspace toggles
  const [isCreatingQuiz, setIsCreatingQuiz] = useState<boolean>(false);
  const [isCreatingDeck, setIsCreatingDeck] = useState<boolean>(false);
  const [creatorMode, setCreatorMode] = useState<'manual' | 'ai'>('ai');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  
  // General Creator Field States
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [aiTopic, setAiTopic] = useState<string>('');
  const [aiItemCount, setAiItemCount] = useState<number>(5);
  
  // Manual Quiz items
  const [manualQuestions, setManualQuestions] = useState<any[]>([
    { questionText: '', options: ['', '', '', ''], correctAnswerIdx: 0, explanation: '' }
  ]);
  // Manual Flashcard items
  const [manualCards, setManualCards] = useState<any[]>([
    { front: '', back: '' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Lighting Mode State ---
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vigyan_guru_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vigyan_guru_theme', next);
      return next;
    });
  };

  // --- Study Friends Circles ---
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [groupNoteText, setGroupNoteText] = useState('');
  const [searchGroupQuery, setSearchGroupQuery] = useState('');

  // --- Weekly Assessments ---
  const [weeklyTestHistory, setWeeklyTestHistory] = useState<any[]>([]);
  const [testPreference, setTestPreference] = useState<{ weekday: string; format: 'oral' | 'written'; topic: string }>({
    weekday: 'Saturday',
    format: 'oral',
    topic: 'Physics Foundations'
  });
  const [activeTest, setActiveTest] = useState<{
    questionText: string;
    topic: string;
    format: 'oral' | 'written';
    response: string;
    isSubmitting: boolean;
    result: { score: number; feedback: string } | null;
  } | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [optInAlerts, setOptInAlerts] = useState<boolean>(() => {
    return localStorage.getItem('opt_in_alerts') === 'true';
  });

  const toggleOptInAlerts = () => {
    setOptInAlerts(prev => {
      const next = !prev;
      localStorage.setItem('opt_in_alerts', String(next));
      return next;
    });
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('last_user_id');
    if (savedEmail) {
      setRememberedEmail(savedEmail);
      setAuthForm(prev => ({ ...prev, email: savedEmail }));
    }

    // Check if there is an active local Vigyan Guru session first
    const activeSessionStr = localStorage.getItem('vigyan_guru_session');
    if (activeSessionStr) {
      try {
        const activeLocalUser = JSON.parse(activeSessionStr);
        setUser(activeLocalUser);
        if (activePage === 'auth') {
          setActivePage('home');
        }
      } catch (e) {
        console.error("Failed to parse local session", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If we have an active local session, do not override it with Firebase state
      if (localStorage.getItem('vigyan_guru_session')) return;

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
        if (activePage === 'auth') {
          setActivePage('home');
        }
      } else {
        // Only clear user if no local session is present
        if (!localStorage.getItem('vigyan_guru_session')) {
          setUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Synchronize Quizzes in real-time
    const qQuizzes = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeQuizzes = onSnapshot(qQuizzes, (snapshot) => {
      const qd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(qd);
    }, (err) => {
      console.error("Failed to load synced quizzes", err);
    });

    // Synchronize Flashcard Decks in real-time
    const qDecks = query(collection(db, 'flashcard_decks'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeDecks = onSnapshot(qDecks, (snapshot) => {
      const dd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlashcards(dd);
    }, (err) => {
      console.error("Failed to load synced study decks", err);
    });

    return () => {
      unsubscribeQuizzes();
      unsubscribeDecks();
    };
  }, []);

  useEffect(() => {
    // Synchronize Study Groups in real-time
    const qGroups = query(collection(db, 'study_groups'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const gList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudyGroups(gList);
      // Synchronize active group details if currently opened to fetch messages
      setActiveGroup(prev => {
        if (!prev) return null;
        const updated = gList.find(g => g.id === prev.id);
        return updated || null;
      });
    }, (err) => {
      console.error("Failed to sync study groups", err);
    });

    // Synchronize Weekly Tests in real-time
    const qTests = query(collection(db, 'weekly_tests'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeTests = onSnapshot(qTests, (snapshot) => {
      const tList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWeeklyTestHistory(tList);
    }, (err) => {
      console.error("Failed to sync weekly tests", err);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeTests();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Weekly Test Scheduling & Alerts ---
  const weekdayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentWeekday = weekdayOptions[new Date().getDay()];
  const isTestDayToday = currentWeekday.toLowerCase() === testPreference.weekday.toLowerCase();

  const getDaysUntilTest = () => {
    const todayIdx = new Date().getDay();
    const targetIdx = weekdayOptions.findIndex(d => d.toLowerCase() === testPreference.weekday.toLowerCase());
    if (targetIdx === -1) return 0;
    let diff = targetIdx - todayIdx;
    if (diff < 0) {
      diff += 7;
    }
    return diff;
  };

  useEffect(() => {
    if (optInAlerts && isTestDayToday) {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification("🚨 Weekly Socratic Assessment Day is LIVE!", {
              body: `Vigyan Guru: Today is your weekly ${testPreference.format} assessment. Topic: ${testPreference.topic}. Check the portal now!`,
              tag: 'vigyan-guru-test'
            });
          } catch (e) {
            console.warn("Notification error:", e);
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification("🚨 Weekly Socratic Assessment Day is LIVE!", {
                body: `Vigyan Guru: Assess your science insights on ${testPreference.topic}!`,
                tag: 'vigyan-guru-test'
              });
            }
          });
        }
      }
    }
  }, [optInAlerts, isTestDayToday, testPreference]);

  // --- Study Groups Cooperative Mechanics ---
  const createStudyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupTitle.trim()) return;
    try {
      const payload = {
        title: newGroupTitle.trim(),
        description: newGroupDesc.trim() || 'Cooperative research & exploration',
        createdBy: user?.uid || 'anonymous',
        createdByAuthor: user?.username || 'Guest Scholar',
        members: [{
          uid: user?.uid || 'anonymous',
          username: user?.username || 'Guest Scholar',
          email: user?.email || 'guest@scholar.com'
        }],
        sharedNotes: [
          {
            sender: 'Vigyan Guru Bot',
            text: `Welcome to "${newGroupTitle.trim()}" study circle! Share ideas, pool resources, and review quizzes together!`,
            createdAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'study_groups'), payload);
      setNewGroupTitle('');
      setNewGroupDesc('');
      setIsCreatingGroup(false);
      setActiveGroup({ id: docRef.id, ...payload });
      confetti({ particleCount: 40, spread: 60 });
    } catch (err: any) {
      console.error("Failed to create study group:", err);
      handleFirestoreError(err, OperationType.WRITE, 'study_groups');
    }
  };

  const joinStudyGroup = async (group: any) => {
    if (!user) return;
    const isMember = group.members.some((m: any) => m.uid === user.uid);
    if (isMember) {
      setActiveGroup(group);
      return;
    }

    const updatedMembers = [
      ...group.members,
      {
        uid: user.uid,
        username: user.username,
        email: user.email || ''
      }
    ];

    try {
      await setDoc(doc(db, 'study_groups', group.id), {
        members: updatedMembers
      }, { merge: true });
      
      setActiveGroup({ ...group, members: updatedMembers });
      confetti({ particleCount: 30, spread: 50 });
    } catch (err: any) {
      console.error("Failed to join study group:", err);
      handleFirestoreError(err, OperationType.WRITE, `study_groups/${group.id}`);
    }
  };

  const leaveStudyGroup = async (group: any) => {
    if (!user) return;
    const updatedMembers = group.members.filter((m: any) => m.uid !== user.uid);
    try {
      if (updatedMembers.length === 0) {
        await deleteDoc(doc(db, 'study_groups', group.id));
        setActiveGroup(null);
      } else {
        await setDoc(doc(db, 'study_groups', group.id), {
          members: updatedMembers
        }, { merge: true });
        setActiveGroup(null);
      }
    } catch (err: any) {
      console.error("Failed to leave group:", err);
      handleFirestoreError(err, OperationType.DELETE, `study_groups/${group.id}`);
    }
  };

  const postGroupNote = async () => {
    if (!groupNoteText.trim() || !activeGroup) return;
    const note = {
      sender: user?.username || 'Guest Scholar',
      text: groupNoteText.trim(),
      createdAt: new Date().toISOString()
    };
    const updatedNotes = [...(activeGroup.sharedNotes || []), note];
    try {
      await setDoc(doc(db, 'study_groups', activeGroup.id), {
        sharedNotes: updatedNotes
      }, { merge: true });
      setGroupNoteText('');
      setActiveGroup(prev => prev ? { ...prev, sharedNotes: updatedNotes } : null);
    } catch (err: any) {
      console.error("Failed to send group note:", err);
      handleFirestoreError(err, OperationType.WRITE, `study_groups/${activeGroup.id}`);
    }
  };

  // --- Weekly Assessments Controllers ---
  const startWeeklyTest = async () => {
    setActiveTest({
      questionText: 'Analyzing syllabus and generating Socratic assessment question...',
      topic: testPreference.topic,
      format: testPreference.format,
      response: '',
      isSubmitting: false,
      result: null
    });

    try {
      const question = await generateWeeklyQuestion(testPreference.topic, testPreference.format, selectedLanguage);
      setActiveTest(prev => prev ? { ...prev, questionText: question } : null);
    } catch (e) {
      setActiveTest(prev => prev ? { 
        ...prev, 
        questionText: `Critically describe the core mechanisms, experimental relevance, and formulation of ${testPreference.topic}.` 
      } : null);
    }
  };

  const submitWeeklyTest = async () => {
    if (!activeTest || !activeTest.response.trim() || activeTest.isSubmitting) return;
    
    // Create temporary activeState clone
    const currentActiveTest = { ...activeTest };
    setActiveTest(prev => prev ? { ...prev, isSubmitting: true } : null);

    try {
      const evaluation = await evaluateWeeklyTest(
        currentActiveTest.topic,
        currentActiveTest.format,
        currentActiveTest.questionText,
        currentActiveTest.response,
        selectedLanguage
      );

      const payload = {
        uid: user?.uid || 'anonymous',
        topic: currentActiveTest.topic,
        format: currentActiveTest.format,
        questionText: currentActiveTest.questionText,
        userResponse: currentActiveTest.response,
        score: Number(evaluation.score) || 80,
        feedback: evaluation.feedback || 'Excellent response with fine details.',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'weekly_tests'), payload);

      setActiveTest(prev => prev ? {
        ...prev,
        isSubmitting: false,
        result: evaluation
      } : null);

      if (evaluation.score >= 85) {
        confetti({ particleCount: 120, spread: 80 });
      }
    } catch (e) {
      console.error("Weekly test submission error", e);
      setActiveTest(prev => prev ? { ...prev, isSubmitting: false } : null);
    }
  };

  // Web Speech synthesis (Read Prompt Aloud)
  const speakQuestion = (text: string) => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage === 'Hinglish' ? 'en-IN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Web Speech recognition (Record Voice Response)
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Microphone capture / Speech recognition is not supported in this browser viewport. Please draft your response using the keyboard fallback.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage === 'Hinglish' ? 'en-IN' : 'en-US';

    recognition.onstart = () => {
      setIsRecordingVoice(true);
      setVoiceTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setActiveTest(prev => {
            if (!prev) return null;
            const append = prev.response ? prev.response + ' ' : '';
            return { ...prev, response: append + event.results[i][0].transcript };
          });
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setVoiceTranscript(interim);
    };

    recognition.onerror = (e: any) => {
      console.error("Voice recording error:", e);
      setIsRecordingVoice(false);
    };

    recognition.onend = () => {
      setIsRecordingVoice(false);
    };

    (window as any)._recognitionInstance = recognition;
    recognition.start();
  };

  const stopSpeechRecognition = () => {
    if ((window as any)._recognitionInstance) {
      try {
        (window as any)._recognitionInstance.stop();
      } catch (err) {
        console.warn("End recognition error:", err);
      }
      setIsRecordingVoice(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsAuthLoading(true);
    localStorage.removeItem('vigyan_guru_session'); // clear any custom logins
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
    setAuthErrorCode(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      const emailLower = authForm.email.toLowerCase().trim();

      if (authMode === 'signup') {
        if (authForm.username.trim().length < 3) {
           setAuthError('Full Scholar Name must be at least 3 characters.');
           setIsAuthLoading(false);
           return;
        }
        if (authForm.password.length < 6) {
           setAuthError('Secret Key (Password) must be at least 6 characters.');
           setIsAuthLoading(false);
           return;
        }

        // Check cloud first
        let existsInCloud = false;
        try {
          const docSnap = await getDoc(doc(db, 'vigyan_guru_users', emailLower));
          if (docSnap && docSnap.exists()) {
            existsInCloud = true;
          }
        } catch (dbErr) {
          console.error("Database check failed", dbErr);
        }

        const storedUsersStr = localStorage.getItem('vigyan_guru_users') || '{}';
        const storedUsers = JSON.parse(storedUsersStr);

        if (existsInCloud || storedUsers[emailLower]) {
          setAuthError('This email is already registered. Try switching to Scholar Login instead.');
          setIsAuthLoading(false);
          return;
        }

        // Create a custom robust Vigyan Guru Scholar Profile
        const newLocalUser = {
          uid: 'scholar_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
          email: emailLower,
          username: authForm.username,
          password: authForm.password,
          createdAt: new Date().toISOString()
        };

        // Persist to cloud database so user can log in from any device
        try {
          await setDoc(doc(db, 'vigyan_guru_users', emailLower), newLocalUser);
        } catch (cloudErr: any) {
          console.error("Cloud persistence failed", cloudErr);
          setAuthError('Registration failed to sync with cloud. Please check network connection.');
          setIsAuthLoading(false);
          return;
        }

        // Cache in localStorage
        storedUsers[emailLower] = newLocalUser;
        localStorage.setItem('vigyan_guru_users', JSON.stringify(storedUsers));

        const sessionUser = {
          uid: newLocalUser.uid,
          email: newLocalUser.email,
          displayName: newLocalUser.username,
          username: newLocalUser.username,
          isLocal: true
        };

        localStorage.setItem('vigyan_guru_session', JSON.stringify(sessionUser));
        localStorage.setItem('last_user_id', emailLower);

        setUser(sessionUser);
        setActivePage('home');
      } else {
        // Sign-in Mode
        let scholarData = null;

        // Try to fetch from cloud first
        try {
          const docSnap = await getDoc(doc(db, 'vigyan_guru_users', emailLower));
          if (docSnap && docSnap.exists()) {
            scholarData = docSnap.data();
          }
        } catch (cloudErr) {
          console.error("Cloud lookup failed", cloudErr);
        }

        // Fallback to localStorage for auto-migration of local accounts
        const storedUsersStr = localStorage.getItem('vigyan_guru_users') || '{}';
        const storedUsers = JSON.parse(storedUsersStr);
        const legacyUser = storedUsers[emailLower];

        if (!scholarData && legacyUser) {
          scholarData = legacyUser;
          // Auto migrate legacy local user to Cloud/Firestore for multi-device support
          try {
            await setDoc(doc(db, 'vigyan_guru_users', emailLower), legacyUser);
          } catch (migrateErr) {
            console.error("Failed to auto-migrate legacy user to cloud", migrateErr);
          }
        }

        if (!scholarData || scholarData.password !== authForm.password) {
          setAuthError('Invalid credentials. Please double check your email and secret key.');
          setIsAuthLoading(false);
          return;
        }

        const sessionUser = {
          uid: scholarData.uid,
          email: scholarData.email,
          displayName: scholarData.username,
          username: scholarData.username,
          isLocal: true
        };

        localStorage.setItem('vigyan_guru_session', JSON.stringify(sessionUser));
        localStorage.setItem('last_user_id', emailLower);

        // Update local cache
        if (!storedUsers[emailLower]) {
          storedUsers[emailLower] = scholarData;
          localStorage.setItem('vigyan_guru_users', JSON.stringify(storedUsers));
        }

        setUser(sessionUser);
        setActivePage('home');
      }
    } catch (error: any) {
      console.error("Scholar Auth Error:", error);
      setAuthError('The Vigyan Guru authentication protocol encountered an anomaly. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!authForm.email) {
      setAuthError('Please enter your Identifier (Email) first.');
      return;
    }
    setIsAuthLoading(true);
    try {
      const emailLower = authForm.email.toLowerCase().trim();
      let foundAccount = false;

      // 1. Try to fetch from cloud Firestore
      try {
        const docSnap = await getDoc(doc(db, 'vigyan_guru_users', emailLower));
        if (docSnap && docSnap.exists()) {
          foundAccount = true;
        }
      } catch (cloudErr) {
        console.error("Cloud lookup failed during password helper", cloudErr);
      }

      // 2. Check local fallback
      const storedUsersStr = localStorage.getItem('vigyan_guru_users') || '{}';
      const storedUsers = JSON.parse(storedUsersStr);
      if (storedUsers[emailLower]) {
        foundAccount = true;
      }
      
      if (foundAccount) {
        setAuthError(`Security link sent! Your password helper has been dispatched to ${authForm.email}`);
      } else {
        setAuthError('This email address is not registered in our scholar database.');
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('vigyan_guru_session');
    await signOut(auth);
    setUser(null);
    setActivePage('auth');
  };

  const renderAuth = () => (
    <div className="flex-1 overflow-y-auto z-10">
      <div className="min-h-full flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-3xl rounded-[2rem] md:rounded-[3rem] border border-white/10 p-5 md:p-10 shadow-2xl relative my-auto shadow-black/40"
        >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-sky-400"></div>
        <div className="text-center mb-6 md:mb-8">
          <Logo size="md" className="mx-auto mb-4 md:mb-6" />
          <h2 className="text-2xl md:text-3xl font-serif italic mb-1 md:mb-2">
            {authMode === 'login' ? 'Scholar Login' : 'Scholar Registration'}
          </h2>
          <p className="text-[9px] md:text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">
            {authMode === 'login' ? 'Continue Your Research' : 'Create Your Scientific Profile'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 md:space-y-5">
          {authMode === 'signup' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-1.5 ml-4">Full Scholar Name</label>
              <input 
                required
                value={authForm.username}
                onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="e.g. Isaac Newton"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10 text-sm"
              />
            </motion.div>
          )}
          <div>
            <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-1.5 ml-4">Identifier (Email)</label>
            <input 
              required
              type="email"
              value={authForm.email}
              onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="scholar@vidyapeeth.edu"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10 text-sm"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-4">
              <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest">Secret Key (Password)</label>
              {authMode === 'login' && (
                <button 
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-[9px] text-violet-400 font-bold hover:text-white transition-colors"
                >
                  FORGOT?
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                required
                type={showPassword ? "text" : "password"}
                value={authForm.password}
                onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Min 6 characters"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-12 py-3.5 outline-none focus:border-violet-500/50 transition-all text-white placeholder:text-white/10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authMode === 'login' && (
            <div className="flex items-center gap-3 ml-4">
              <input 
                type="checkbox" 
                id="remember" 
                checked={!!rememberedEmail}
                onChange={(e) => {
                  if (e.target.checked) setRememberedEmail(authForm.email);
                  else setRememberedEmail('');
                }}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-violet-600 focus:ring-violet-500/20"
              />
              <label htmlFor="remember" className="text-[10px] font-bold text-white/40 uppercase tracking-widest cursor-pointer select-none">
                Persistent Identity (Remember Me)
              </label>
            </div>
          )}
          
          {authError && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
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
            {isAuthLoading ? 'Connecting...' : (authMode === 'login' ? 'Login' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3 font-bold">
            {authMode === 'login' ? "Don't have an account?" : "Already a member?"}
          </p>
          <button 
            onClick={toggleAuthMode}
            className="w-full text-[10px] font-black text-violet-400 uppercase tracking-widest hover:text-white transition-colors py-3 px-6 border border-violet-500/20 rounded-xl hover:bg-violet-500/10 active:scale-95 bg-violet-500/5 shadow-lg"
          >
            {authMode === 'login' ? 'REGISTER NEW ACCOUNT' : 'LOGIN TO EXISTING'}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-[1px] flex-1 bg-white/10"></div>
          <span className="text-[9px] md:text-[10px] text-white/20 uppercase tracking-widest font-black">or utilize oauth</span>
          <div className="h-[1px] flex-1 bg-white/10"></div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={isAuthLoading}
          className="w-full mt-4 md:mt-6 py-3 md:py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-sm tracking-tighter hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 md:w-5 h-4 md:h-5" alt="Google" />
          {isAuthLoading ? 'SYSCALL ACTIVE...' : 'ENGAGE WITH GOOGLE'}
        </button>
      </motion.div>
    </div>
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
    } catch (error: any) {
      console.error(error);
      setMessages([
        initialMessage,
        { role: 'model', parts: [{ text: `⚠️ **Cosmic Signal Interrupted:** I am currently unable to reach the Socratic brain. This can happen if the API key quota is exhausted or if there's a temporary network issue. Please check your config or try again.` }] }
      ]);
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
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ **Cosmic Signal Interrupted:** ${error?.message || "I had trouble connecting to the Socratic brain. Let's try sending that message again."}` }] }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderNavigation = () => (
    <nav className={`fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 backdrop-blur-2xl border rounded-full md:rounded-[2.5rem] px-1 py-1 md:px-4 md:py-3 flex items-center gap-1 md:gap-6 z-50 shadow-2xl ring-1 ${
      isLight 
        ? 'bg-white/90 border-gray-200 ring-gray-200/50 text-gray-900' 
        : 'bg-white/10 border-white/10 ring-white/5 text-white'
    }`}>
      {[
        { id: 'home', icon: LayoutGrid, label: 'Hub' },
        { id: 'tutor', icon: Sparkles, label: 'Tutor' },
        { id: 'practice', icon: GraduationCap, label: 'Practice' },
        { id: 'streaks', icon: BrainCircuit, label: 'Collective' },
        { id: 'library', icon: History, label: 'Vault' },
        { id: 'reviews', icon: Star, label: 'Reviews' },
        { id: 'contact', icon: MessageSquare, label: 'Contact' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActivePage(item.id as Page)}
          className={`flex items-center gap-2 md:gap-3 px-3 py-2.5 md:px-6 md:py-3 rounded-full md:rounded-2xl font-bold text-[8px] md:text-[10px] tracking-[0.1em] md:tracking-widest transition-all duration-300 uppercase ${
            activePage === item.id 
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' 
              : isLight
                ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
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
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col gap-12 custom-scrollbar pb-32">
      <div className="max-w-screen-xl mx-auto w-full text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-3xl md:text-6xl font-serif italic mb-6 tracking-tight">Wisdom Begins in Wonder.</h2>
          <p className="text-white/40 text-[10px] md:text-sm uppercase tracking-[0.4em] font-medium mb-12">Engineering Architect Core • Project Hub</p>
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

        {/* Footer with Contact Link */}
        <footer className={`mt-16 pt-8 border-t ${isLight ? 'border-gray-200 text-gray-800' : 'border-white/5 text-white/50'} flex flex-col sm:flex-row items-center justify-between gap-4 pb-12 opacity-80`}>
          <p className="text-[10px] uppercase tracking-wider font-semibold">© {new Date().getFullYear()} Vigyan Guru • Academic Socratic Platform.</p>
          <div className="flex gap-6">
            <button 
              onClick={() => setActivePage('home')} 
              className="text-[10px] uppercase tracking-widest font-black hover:text-indigo-600 dark:hover:text-violet-400 transition-colors"
            >
              Hub
            </button>
            <button 
              onClick={() => setActivePage('tutor')} 
              className="text-[10px] uppercase tracking-widest font-black hover:text-indigo-600 dark:hover:text-violet-400 transition-colors"
            >
              Tutor
            </button>
            <button 
              onClick={() => setActivePage('contact')} 
              className="text-[10px] uppercase tracking-widest font-black hover:text-indigo-600 dark:hover:text-violet-400 transition-colors underline"
            >
              Contact Support
            </button>
            <button 
              onClick={() => setActivePage('reviews')} 
              className="text-[10px] uppercase tracking-widest font-black hover:text-indigo-600 dark:hover:text-violet-400 transition-colors"
            >
              Reviews
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  const renderStreaks = () => (
    <div className="flex-1 p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-screen-2xl mx-auto w-full z-10 overflow-y-auto pb-32">
      <div className="lg:col-span-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif italic">Study Hub</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-black italic">Collaborative Heuristics • Global Server</p>
          </div>
          <button className="w-full md:w-auto px-6 py-3 bg-violet-600 font-bold text-sm rounded-2xl shadow-lg shadow-violet-600/20">
            CREATE ROOM
          </button>
        </header>

        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-12 text-center relative overflow-hidden">
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
    <div className="flex-1 p-4 md:p-8 max-w-screen-2xl mx-auto w-full z-10 space-y-12 overflow-y-auto pb-32">
      <header>
        <h2 className="text-3xl md:text-5xl font-serif italic mb-2 tracking-tight">Wisdom Repository</h2>
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
    <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 overflow-y-auto lg:overflow-hidden z-10 relative custom-scrollbar pb-32 md:pb-8">
      <div className="lg:col-span-4 flex flex-col gap-6 lg:overflow-y-auto md:pr-2 custom-scrollbar order-2 lg:order-1">
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

      <div className="lg:col-span-8 flex flex-col bg-white/5 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden relative ring-1 ring-white/5 order-1 lg:order-2 min-h-[500px] lg:h-full">
        <div className="px-4 md:px-8 py-5 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative shrink-0">
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
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar"
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
                  <div className={`max-w-[90%] md:max-w-[85%] rounded-[1.5rem] md:rounded-[2rem] shadow-2xl ${
                    msg.role === 'user' 
                      ? 'bg-violet-600 text-white px-5 py-3 md:px-6 md:py-4 rounded-tr-none border border-violet-400/30 font-medium text-sm md:text-base' 
                      : 'bg-white/5 backdrop-blur-md text-white/90 px-6 py-5 md:px-8 md:py-6 rounded-tl-none font-serif text-base md:text-[18px] leading-relaxed border border-white/10'
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

        <div className="p-4 md:p-8 border-t border-white/10 bg-[#050510]/50 backdrop-blur-2xl">
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
                className="w-full pl-5 pr-14 py-4 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 focus:bg-white/[0.08] transition-all resize-none max-h-40 min-h-[56px] md:min-h-[64px] text-sm md:text-base text-white placeholder-white/20 shadow-inner outline-none"
                placeholder={problemImage || messages.length > 0 ? "Next milestone..." : "What project today?"}
                disabled={isAnalyzing}
              />
              <button 
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isAnalyzing}
                className="absolute right-2.5 bottom-2.5 w-10 h-10 md:w-11 md:h-11 bg-violet-600 text-white rounded-xl md:rounded-2xl shadow-xl hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/10 transition-all flex items-center justify-center group/btn active:scale-90"
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

  // --- Quizzes and Flashcards Engine Operations ---

  const deleteQuiz = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this quiz deck?")) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      if (activeQuiz?.id === id) {
        setActiveQuiz(null);
        setQuizScore(null);
      }
    } catch (err) {
      console.error("Failed to delete quiz", err);
      alert("Could not remove quiz from Firestore.");
    }
  };

  const deleteFlashcardDeck = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this flashcard deck?")) return;
    try {
      await deleteDoc(doc(db, 'flashcard_decks', id));
      if (activeDeck?.id === id) {
        setActiveDeck(null);
        setDeckScores(null);
      }
    } catch (err) {
      console.error("Failed to delete flashcards deck", err);
      alert("Could not remove flashcards deck from Firestore.");
    }
  };

  const generateQuizAI = async (topic: string, count: number) => {
    if (!topic.trim()) return;
    setIsGeneratingAI(true);
    try {
      const contents = [
        {
          role: 'user',
          parts: [{
            text: `Generate a multiple choice science quiz about "${topic}" with exactly ${count} educational questions.
Return ONLY a valid JSON object matching this schema. Avoid any wrapping markdowns except clean JSON:
{
  "title": "A short engaging quiz title",
  "description": "Engaging description summarizing the core topic and heuristics",
  "questions": [
    {
      "questionText": "The question string",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIdx": 0,
      "explanation": "Why Option A is correct"
    }
  ]
}`
          }]
        }
      ];

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: "You are Vigyan Guru, generating highly educational, scientifically accurate Multiple Choice Quizzes. Respond ONLY with a clean JSON output matching the requested schema. No other text or markdown tags.",
          model: "gemini-3.5-flash",
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not contact the Socratic brain.");
      }

      const resData = await response.json();
      let quizJSON;
      try {
        const txt = resData.candidates?.[0]?.content?.parts?.[0]?.text || resData.text || "";
        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        const cleanStr = jsonMatch ? jsonMatch[0] : txt;
        quizJSON = JSON.parse(cleanStr);
      } catch (parseErr) {
        console.error("Failed to parse Gemini model response as JSON", resData, parseErr);
        throw new Error("Vigyan Guru returned a complex cosmic layout. Try again.");
      }

      if (!quizJSON.title || !quizJSON.questions || !Array.isArray(quizJSON.questions)) {
        throw new Error("Invalid structure returned by the Socratic brain.");
      }

      const quizPayload = {
        uid: user?.uid || 'anonymous',
        author: user?.username || 'Anonymous Scholar',
        title: quizJSON.title,
        description: quizJSON.description || `AI Assisted study session on ${topic}`,
        questions: quizJSON.questions,
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, 'quizzes'), quizPayload);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'quizzes');
      }

      setIsCreatingQuiz(false);
      setAiTopic('');
      confetti({ particleCount: 150, spread: 80, colors: ['#a78bfa', '#f472b6', '#34d399'] });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An issue occurred while generating the quiz.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateFlashcardDeckAI = async (topic: string, count: number) => {
    if (!topic.trim()) return;
    setIsGeneratingAI(true);
    try {
      const contents = [
        {
          role: 'user',
          parts: [{
            text: `Generate a list of exactly ${count} science study flashcards about "${topic}".
Each card must pair a key scientific definition/concept with its simplified, deep explanation.
Return ONLY a valid JSON object matching this schema. Avoid any wrapping markdowns except clean JSON:
{
  "title": "A short engaging deck title",
  "description": "Engaging description of facts and mental models enclosed",
  "cards": [
    {
      "front": "Term, formula, or concept name",
      "back": "Clear, deep explanation, analogy, or critical definition"
    }
  ]
}`
          }]
        }
      ];

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: "You are Vigyan Guru, generating highly effective scientific Flashcards for retention. Respond ONLY with a clean JSON output matching the requested schema. No other text or markdown tags.",
          model: "gemini-3.5-flash",
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not contact the Socratic brain.");
      }

      const resData = await response.json();
      let deckJSON;
      try {
        const txt = resData.candidates?.[0]?.content?.parts?.[0]?.text || resData.text || "";
        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        const cleanStr = jsonMatch ? jsonMatch[0] : txt;
        deckJSON = JSON.parse(cleanStr);
      } catch (parseErr) {
        console.error("Failed to parse flashcard deck JSON", resData, parseErr);
        throw new Error("Vigyan Guru returned a complex cosmic layout. Try again.");
      }

      if (!deckJSON.title || !deckJSON.cards || !Array.isArray(deckJSON.cards)) {
        throw new Error("Invalid structure returned by the Socratic brain.");
      }

      const deckPayload = {
        uid: user?.uid || 'anonymous',
        author: user?.username || 'Anonymous Scholar',
        title: deckJSON.title,
        description: deckJSON.description || `AI Retention deck for ${topic}`,
        cards: deckJSON.cards,
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, 'flashcard_decks'), deckPayload);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'flashcard_decks');
      }

      setIsCreatingDeck(false);
      setAiTopic('');
      confetti({ particleCount: 150, spread: 80, colors: ['#60a5fa', '#34d399', '#fbbf24'] });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An issue occurred while generating the flashcards.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const saveManualQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please provide a Quiz title.");
      return;
    }
    const invalidQuestion = manualQuestions.some(q => !q.questionText.trim() || q.options.some((o: string) => !o.trim()));
    if (invalidQuestion) {
      alert("Please fill in all questions and options fully.");
      return;
    }

    try {
      const quizPayload = {
        uid: user?.uid || 'anonymous',
        author: user?.username || 'Anonymous Scholar',
        title: newTitle,
        description: newDescription || 'Socratic scholar revision set',
        questions: manualQuestions,
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, 'quizzes'), quizPayload);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'quizzes');
      }

      setIsCreatingQuiz(false);
      setNewTitle('');
      setNewDescription('');
      setManualQuestions([{ questionText: '', options: ['', '', '', ''], correctAnswerIdx: 0, explanation: '' }]);
      confetti({ particleCount: 100, spread: 60 });
    } catch (err) {
      console.error("Failed to save manual quiz", err);
      alert("Could not register your quiz in the database.");
    }
  };

  const saveManualDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please provide a Flashcard Deck title.");
      return;
    }
    const invalidCard = manualCards.some(c => !c.front.trim() || !c.back.trim());
    if (invalidCard) {
      alert("Please fill in both the Front and Back sides for all flashcards.");
      return;
    }

    try {
      const deckPayload = {
        uid: user?.uid || 'anonymous',
        author: user?.username || 'Anonymous Scholar',
        title: newTitle,
        description: newDescription || 'Core scientific flashcards deck',
        cards: manualCards,
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, 'flashcard_decks'), deckPayload);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'flashcard_decks');
      }

      setIsCreatingDeck(false);
      setNewTitle('');
      setNewDescription('');
      setManualCards([{ front: '', back: '' }]);
      confetti({ particleCount: 100, spread: 60 });
    } catch (err) {
      console.error("Failed to save manual deck", err);
      alert("Could not register your study deck in the database.");
    }
  };

  // --- Active Player Modifiers ---
  
  const startQuiz = (quiz: any) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIdx(0);
    setSelectedAnswerIdx(null);
    setShowExplanation(false);
    setQuizScore({ correct: 0, total: quiz.questions.length, answered: 0, finished: false });
  };

  const selectAnswer = (ansIdx: number) => {
    if (selectedAnswerIdx !== null) return;
    setSelectedAnswerIdx(ansIdx);
    setShowExplanation(true);
    const isCorrect = ansIdx === activeQuiz.questions[currentQuestionIdx].correctAnswerIdx;
    setQuizScore(prev => {
      if (!prev) return null;
      return {
        ...prev,
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        answered: prev.answered + 1
      };
    });
  };

  const nextQuizQuestion = () => {
    if (currentQuestionIdx + 1 < activeQuiz.questions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedAnswerIdx(null);
      setShowExplanation(false);
    } else {
      setQuizScore(prev => {
        if (!prev) return null;
        return { ...prev, finished: true };
      });
    }
  };

  const startDeck = (deck: any) => {
    setActiveDeck(deck);
    setCurrentCardIdx(0);
    setIsFlipped(false);
    setDeckScores({ mastered: 0, review: 0 });
  };

  const handleCardScore = (type: 'mastered' | 'review') => {
    setDeckScores(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [type]: prev[type] + 1
      };
    });
    
    if (currentCardIdx + 1 < activeDeck.cards.length) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentCardIdx(prev => prev + 1);
      }, 150);
    } else {
      setCurrentCardIdx(activeDeck.cards.length);
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden overflow-y-auto custom-scrollbar pb-32">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 via-transparent to-violet-600/5 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative z-10 my-8"
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

  const renderPractice = () => {
    // Determine what mode we are playing or creating
    if (activeQuiz) {
      const q = activeQuiz.questions[currentQuestionIdx];
      const isQuizFinished = quizScore?.finished;

      return (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col items-center custom-scrollbar pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl w-full bg-[#0d0d1b] border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl relative z-10"
          >
            {/* Header / Tracker */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <button 
                onClick={() => { setActiveQuiz(null); setQuizScore(null); }}
                className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                type="button"
              >
                ← Return to Lobby
              </button>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-bold text-violet-300 uppercase tracking-widest">
                  Challenge Quiz
                </span>
              </div>
            </div>

            {!isQuizFinished ? (
              <div>
                {/* Progress bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center text-xs text-white/40 mb-2 font-bold uppercase tracking-wider">
                    <span>Question {currentQuestionIdx + 1} of {activeQuiz.questions.length}</span>
                    <span className="text-violet-400">{Math.round(((currentQuestionIdx) / activeQuiz.questions.length) * 100)}% Complete</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                      style={{ width: `${((currentQuestionIdx) / activeQuiz.questions.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Question */}
                <h3 className="text-xl md:text-2xl font-serif text-white mb-8 leading-relaxed">
                  {q.questionText}
                </h3>

                {/* Options */}
                <div className="grid grid-cols-1 gap-3 mb-8">
                  {q.options.map((option: string, idx: number) => {
                    const isSelected = selectedAnswerIdx === idx;
                    const isCorrect = q.correctAnswerIdx === idx;
                    const hasAnswered = selectedAnswerIdx !== null;

                    let btnStyle = "bg-white/5 border-white/10 text-white/80 hover:bg-white/10";
                    if (hasAnswered) {
                      if (isCorrect) {
                        btnStyle = "bg-green-500/15 border-green-500/40 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.1)]";
                      } else if (isSelected) {
                        btnStyle = "bg-red-500/15 border-red-500/40 text-red-300";
                      } else {
                        btnStyle = "bg-white/2 border-white/5 text-white/30 cursor-not-allowed";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => selectAnswer(idx)}
                        disabled={hasAnswered}
                        type="button"
                        className={`w-full p-4 md:p-5 text-left rounded-2xl border text-sm md:text-base font-medium transition-all duration-200 flex items-start gap-4 ${btnStyle}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          hasAnswered && isCorrect ? 'bg-green-500 text-black' :
                          hasAnswered && isSelected ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation block */}
                {showExplanation && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 mb-8"
                  >
                    <div className="flex items-center gap-2 mb-3 text-indigo-300 font-bold uppercase text-[10px] tracking-widest">
                      <Brain className="w-4 h-4" />
                      <span>Socratic Analysis</span>
                    </div>
                    <p className="text-xs md:text-sm text-indigo-100/80 leading-relaxed font-sans">
                      {q.explanation || "No explanation provided. Use Socratic reasoning to explore."}
                    </p>
                  </motion.div>
                )}

                {/* Controls */}
                <div className="flex justify-end">
                  {selectedAnswerIdx !== null ? (
                    <button
                      onClick={nextQuizQuestion}
                      type="button"
                      className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-violet-600/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <span>{currentQuestionIdx + 1 === activeQuiz.questions.length ? "Finish Quiz" : "Next Question"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <p className="text-xs text-white/30 italic">Select an option to evaluate your answer.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <Trophy className="w-10 h-10 text-amber-400" />
                </div>
                <h3 className="text-3xl font-serif text-white mb-2 tracking-tight">Challenge Concluded!</h3>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-8 font-bold">Heuristic Valuation Index</p>

                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-10">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-green-400">{quizScore?.correct}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Correct</div>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-red-400">{(quizScore?.total || 0) - (quizScore?.correct || 0)}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Incorrect</div>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-violet-400">
                      {Math.round(((quizScore?.correct || 0) / (quizScore?.total || 1)) * 100)}%
                    </div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Accuracy</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                  <button
                    onClick={() => startQuiz(activeQuiz)}
                    type="button"
                    className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retake Session</span>
                  </button>
                  <button
                    onClick={() => { setActiveQuiz(null); setQuizScore(null); }}
                    type="button"
                    className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
                  >
                    <span>Lobby Home</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    if (activeDeck) {
      const isFinished = currentCardIdx >= activeDeck.cards.length;
      const c = !isFinished ? activeDeck.cards[currentCardIdx] : null;

      return (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col items-center custom-scrollbar pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-900/10 via-transparent to-transparent pointer-events-none"></div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl w-full bg-[#0d0d1b] border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl relative z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <button 
                onClick={() => { setActiveDeck(null); setDeckScores(null); }}
                className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                type="button"
              >
                ← Return to Lobby
              </button>
              <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-300 uppercase tracking-widest">
                Active Revision
              </span>
            </div>

            {!isFinished && c ? (
              <div>
                {/* Meta details */}
                <div className="flex justify-between text-xs text-white/40 mb-6 font-bold uppercase tracking-wider">
                  <span>Flashcard {currentCardIdx + 1} of {activeDeck.cards.length}</span>
                  <span className="text-sky-400">
                    Mastered: {deckScores?.mastered} • Review: {deckScores?.review}
                  </span>
                </div>

                {/* Double sided flipping card */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full min-h-[220px] md:min-h-[260px] cursor-pointer relative perspective-1000 mb-8"
                >
                  <div className={`w-full h-full relative duration-500 transform-style-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    {/* Front side */}
                    <div className="absolute inset-0 [backface-visibility:hidden] bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-xl">
                      <div className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-4">Scientific Prompt / Concept</div>
                      <p className="text-xl md:text-2xl font-serif text-white tracking-wide leading-relaxed">
                        {c.front}
                      </p>
                      <div className="mt-8 text-[9px] text-white/30 uppercase tracking-widest font-bold">Click to flip & explore</div>
                    </div>

                    {/* Back side */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-sky-950/20 border border-sky-500/20 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-xl overflow-y-auto">
                      <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-4">Socratic Definition & Analogy</div>
                      <p className="text-sm md:text-base leading-relaxed text-sky-100/90 font-sans">
                        {c.back}
                      </p>
                      <div className="mt-6 text-[9px] text-white/30 uppercase tracking-widest font-bold">Click to flip back</div>
                    </div>
                  </div>
                </div>

                {/* Micro prompt actions */}
                <div className="flex justify-center gap-4">
                  {isFlipped ? (
                    <div className="flex gap-3 w-full animate-fade-in">
                      <button
                        onClick={() => handleCardScore('review')}
                        type="button"
                        className="flex-1 py-3 px-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all active:scale-95"
                      >
                        Needs Review ❌
                      </button>
                      <button
                        onClick={() => handleCardScore('mastered')}
                        type="button"
                        className="flex-1 py-3 px-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-200 text-xs font-bold uppercase tracking-widest hover:bg-green-500/20 transition-all active:scale-95 shadow-md shadow-green-500/5"
                      >
                        Mastered! ✅
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsFlipped(true)}
                      type="button"
                      className="py-3 px-8 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                    >
                      Flip Card
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-20 h-20 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <Brain className="w-10 h-10 text-sky-400" />
                </div>
                <h3 className="text-3xl font-serif text-white mb-2 tracking-tight">Deck Completed!</h3>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-8 font-bold">Retrieval Analysis Index</p>

                <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-10">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-green-400">{deckScores?.mastered}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Mastered</div>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-sky-400">{deckScores?.review}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1">Need Review</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                  <button
                    onClick={() => startDeck(activeDeck)}
                    type="button"
                    className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Restart Review</span>
                  </button>
                  <button
                    onClick={() => { setActiveDeck(null); setDeckScores(null); }}
                    type="button"
                    className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-700 rounded-xl text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Lobby Home</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    if (isCreatingQuiz || isCreatingDeck) {
      const typeLabel = isCreatingQuiz ? "Quiz Challenge" : "Flashcard Deck";
      const isAI = creatorMode === 'ai';

      return (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col items-center custom-scrollbar pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 via-transparent to-transparent pointer-events-none"></div>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl w-full bg-[#0d0d1b] border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl relative z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
              <button 
                onClick={() => { setIsCreatingQuiz(false); setIsCreatingDeck(false); }}
                className="text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                type="button"
              >
                ← Back to Lobby
              </button>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Create {typeLabel}
              </span>
            </div>

            {/* Mode Select Tabs */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-8">
              <button
                type="button"
                onClick={() => setCreatorMode('ai')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  isAI ? 'bg-violet-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
                }`}
              >
                🔮 Socratic AI Generator
              </button>
              <button
                type="button"
                onClick={() => setCreatorMode('manual')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  !isAI ? 'bg-violet-600 text-white shadow-lg' : 'text-white/40 hover:text-white/70'
                }`}
              >
                📝 Manual Composer
              </button>
            </div>

            {isAI ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 tracking-widest mb-2">
                    Scientific Topic of Study
                  </label>
                  <input
                    type="text"
                    required
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Mendelian Genetics, Photoelectric Effect, Quantum Tunnelling..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 tracking-widest mb-2">
                    Scope Grid (Total Items)
                  </label>
                  <select
                    value={aiItemCount}
                    onChange={(e) => setAiItemCount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 transition-all"
                  >
                    {[3, 5, 8, 10, 15].map((num) => (
                      <option key={num} value={num} className="bg-[#0c0c1b] text-white">
                        {num} {isCreatingQuiz ? 'Questions' : 'Double-Sided Cards'}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isGeneratingAI || !aiTopic.trim()}
                  onClick={() => {
                    if (isCreatingQuiz) {
                      generateQuizAI(aiTopic, aiItemCount);
                    } else {
                      generateFlashcardDeckAI(aiTopic, aiItemCount);
                    }
                  }}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Cosmic Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate with Vigyan AI</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              // MANUAL COMPOSER FORM
              <form onSubmit={isCreatingQuiz ? saveManualQuiz : saveManualDeck} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 tracking-widest mb-2">
                    {isCreatingQuiz ? "Quiz Challenge Title" : "Study Deck Title"}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Human Endocrine System Essentials"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-white/40 tracking-widest mb-2">
                    Learning Intent / Description
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief summary of concepts this deck exercises..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 transition-all resize-none font-sans"
                  />
                </div>

                {isCreatingQuiz ? (
                  // MANAGE MANUAL QUESTIONS
                  <div className="space-y-6 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Questions list</span>
                      <button
                        type="button"
                        onClick={() => setManualQuestions(prev => [...prev, { questionText: '', options: ['', '', '', ''], correctAnswerIdx: 0, explanation: '' }])}
                        className="px-3 py-1.5 rounded-lg bg-violet-600/10 border border-violet-500/40 text-[10px] font-bold text-violet-300 uppercase tracking-widest flex items-center gap-1 hover:bg-violet-600/20 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Question</span>
                      </button>
                    </div>

                    {manualQuestions.map((item, qIdx) => (
                      <div key={qIdx} className="p-4 rounded-2xl bg-white/2 border border-white/5 space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white/50">Question #{qIdx + 1}</span>
                          {manualQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setManualQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                              className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="What is the question?"
                          value={item.questionText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, questionText: val } : q));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 transition-all font-sans"
                        />

                        {/* Options */}
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold uppercase text-white/30 tracking-widest">
                            Multiple-Choice Options
                          </label>
                          {item.options.map((opt: string, optIdx: number) => (
                            <div key={optIdx} className="flex gap-2 items-center">
                              <span className="text-xs font-bold text-white/30 w-5">{String.fromCharCode(65 + optIdx)}.</span>
                              <input
                                type="text"
                                required
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                value={opt}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setManualQuestions(prev => prev.map((q, i) => i === qIdx ? {
                                    ...q,
                                    options: q.options.map((o: string, oi: number) => oi === optIdx ? val : o)
                                  } : q));
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50 transition-all font-sans"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Correct Option */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-white/30 tracking-widest mb-1.5">
                              Correct Choice Index
                            </label>
                            <select
                              value={item.correctAnswerIdx}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setManualQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, correctAnswerIdx: val } : q));
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                            >
                              {item.options.map((_: any, idx: number) => (
                                <option key={idx} value={idx} className="bg-[#0d0d1b] text-white">
                                  Option {String.fromCharCode(65 + idx)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Explanation */}
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-white/30 tracking-widest mb-1">
                            Socratic Explanation (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Why is this index correct?"
                            value={item.explanation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManualQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, explanation: val } : q));
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/20 outline-none font-sans"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // MANAGE MANUAL FLASHCARDS
                  <div className="space-y-6 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-sky-300 uppercase tracking-widest">Cards Checklist</span>
                      <button
                        type="button"
                        onClick={() => setManualCards(prev => [...prev, { front: '', back: '' }])}
                        className="px-3 py-1.5 rounded-lg bg-sky-600/10 border border-sky-500/40 text-[10px] font-bold text-sky-300 uppercase tracking-widest flex items-center gap-1 hover:bg-sky-600/20 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Flipcard</span>
                      </button>
                    </div>

                    {manualCards.map((card, cIdx) => (
                      <div key={cIdx} className="p-4 rounded-2xl bg-white/2 border border-white/5 space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white/50">Card #{cIdx + 1}</span>
                          {manualCards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setManualCards(prev => prev.filter((_, i) => i !== cIdx))}
                              className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8px] font-bold uppercase text-white/30 tracking-widest mb-1">Front (Term / Prompt)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Mitochondria"
                              value={card.front}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualCards(prev => prev.map((c, i) => i === cIdx ? { ...c, front: val } : c));
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/25 outline-none font-sans"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold uppercase text-white/30 tracking-widest mb-1">Back (Explanation / Definition)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Powerhouse of the cell, synthesizes ATP..."
                              value={card.back}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualCards(prev => prev.map((c, i) => i === cIdx ? { ...c, back: val } : c));
                              }}
                              className="w-full bg-[#080814] border border-white/10 rounded-xl px-4 py-2 text-xs text-sky-100 placeholder-white/25 outline-none font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-violet-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-violet-600/20 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                  Save Study Deck in Database
                </button>
              </form>
            )}
          </motion.div>
        </div>
      );
    }

    // Lobby View
    const filteredQuizzes = quizzes;
    const filteredDecks = flashcards;

    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col items-center custom-scrollbar pb-32">
        <div className="absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b from-violet-600/5 to-transparent pointer-events-none"></div>

        <div className="max-w-screen-xl mx-auto w-full flex flex-col gap-10">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-300 uppercase tracking-widest">
                  Revision Portal
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Intellect Studio</h1>
              <p className="text-sm text-white/40 mt-2 max-w-lg leading-relaxed uppercase tracking-wider text-[10px] font-semibold">
                Simulate challenges and maximize scientific concept retention.
              </p>
            </div>

            {/* Creation trigger CTA */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCreatorMode('ai');
                  setAiTopic('');
                  setIsCreatingQuiz(true);
                }}
                className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-violet-600/20 hover:scale-102 active:scale-98"
                type="button"
              >
                <Plus className="w-4 h-4" />
                <span>Create Quiz</span>
              </button>
              <button
                onClick={() => {
                  setCreatorMode('ai');
                  setAiTopic('');
                  setIsCreatingDeck(true);
                }}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-102 active:scale-98"
                type="button"
              >
                <Plus className="w-4 h-4" />
                <span>Create Flashcards</span>
              </button>
            </div>
          </div>

          {/* Nav Tab Selectors */}
          <div className="flex flex-wrap gap-2 md:gap-4 border-b border-white/10 pb-1">
            <button
              onClick={() => setActivePracticeTab('quizzes')}
              type="button"
              className={`pb-3 px-1 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                activePracticeTab === 'quizzes' 
                  ? 'border-violet-500 text-violet-400' 
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Quizzes ({filteredQuizzes.length})</span>
            </button>
            <button
              onClick={() => setActivePracticeTab('flashcards')}
              type="button"
              className={`pb-3 px-1 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                activePracticeTab === 'flashcards' 
                  ? 'border-sky-500 text-sky-400' 
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span>Flashcard Decks ({filteredDecks.length})</span>
            </button>
            <button
              onClick={() => setActivePracticeTab('tests')}
              type="button"
              className={`pb-3 px-1 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                activePracticeTab === 'tests' 
                  ? 'border-rose-500 text-rose-400' 
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Weekly Socratic Tests</span>
              {isTestDayToday && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setActivePracticeTab('groups')}
              type="button"
              className={`pb-3 px-1 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                activePracticeTab === 'groups' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Study Buddies ({studyGroups.length})</span>
            </button>
          </div>

          {/* Lobby rendering panels */}
          {activePracticeTab === 'quizzes' && (
            filteredQuizzes.length === 0 ? (
              <div className={`text-center py-16 rounded-3xl border ${isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-white/2 border-white/5 text-white/70'}`}>
                <p className="text-xs uppercase tracking-widest italic mb-2 opacity-60">No quizzes created yet</p>
                <p className="text-[10px] opacity-40">Be the first to create one manually or generate instantly using Socratic AI!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredQuizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-2xl border transition-all flex flex-col justify-between group relative ${
                      isLight ? 'bg-white border-gray-200 hover:border-violet-500/40 text-gray-900 shadow-sm' : 'bg-white/3 border-white/5 hover:border-violet-500/20 text-white'
                    }`}
                  >
                    {/* Delete capability */}
                    {(user?.uid === quiz.uid || quiz.uid === 'anonymous') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuiz(quiz.id);
                        }}
                        type="button"
                        className="absolute top-4 right-4 text-red-400/50 hover:text-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div>
                      <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest">
                        {quiz.questions?.length || 0} Questions
                      </span>
                      <h4 className={`text-lg font-serif mt-2 leading-snug tracking-wide line-clamp-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>{quiz.title}</h4>
                      <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/40'}`}>{quiz.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[9px] opacity-60 truncate max-w-[120px]">
                        by {quiz.author || 'Scholar'}
                      </span>
                      <button
                        onClick={() => startQuiz(quiz)}
                        type="button"
                        className="px-4 py-2 rounded-lg bg-violet-600/10 border border-violet-500/20 text-[9px] font-bold text-violet-500 uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all shadow-sm"
                      >
                        Start Play
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}

          {activePracticeTab === 'flashcards' && (
            filteredDecks.length === 0 ? (
              <div className={`text-center py-16 rounded-3xl border ${isLight ? 'bg-white border-gray-200 text-gray-800' : 'bg-white/2 border-white/5 text-white/70'}`}>
                <p className="text-xs uppercase tracking-widest italic mb-2 opacity-60">No flashcards created yet</p>
                <p className="text-[10px] opacity-40">Design your retrieval sets or use the Vigyan AI prompt to generate! </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDecks.map((deck) => (
                  <motion.div
                    key={deck.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-2xl border transition-all flex flex-col justify-between group relative ${
                      isLight ? 'bg-white border-gray-200 hover:border-sky-500/40 text-gray-900 shadow-sm' : 'bg-white/3 border-white/5 hover:border-sky-500/20 text-white'
                    }`}
                  >
                    {/* Delete capability */}
                    {(user?.uid === deck.uid || deck.uid === 'anonymous') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFlashcardDeck(deck.id);
                        }}
                        type="button"
                        className="absolute top-4 right-4 text-red-400/50 hover:text-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Deck"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div>
                      <span className="text-[9px] font-bold text-sky-500 uppercase tracking-widest">
                        {deck.cards?.length || 0} Cards
                      </span>
                      <h4 className={`text-lg font-serif mt-2 leading-snug tracking-wide line-clamp-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>{deck.title}</h4>
                      <p className={`text-xs mt-2 line-clamp-2 leading-relaxed ${isLight ? 'text-gray-500' : 'text-white/40'}`}>{deck.description}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[9px] opacity-60 truncate max-w-[120px]">
                        by {deck.author || 'Scholar'}
                      </span>
                      <button
                        onClick={() => startDeck(deck)}
                        type="button"
                        className="px-4 py-2 rounded-lg bg-sky-600/10 border border-sky-500/20 text-[9px] font-bold text-sky-500 uppercase tracking-widest hover:bg-sky-600 hover:text-white transition-all shadow-sm"
                      >
                        Flip Cards
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}

          {activePracticeTab === 'tests' && (
            <div className="space-y-8 w-full">
              {/* Alert Ribbon */}
              {isTestDayToday ? (
                <div className="p-5 md:p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-500">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-amber-500">Weekly Evaluation Day Is Here!</h4>
                      <p className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-200'} mt-1`}>
                        Your customized {testPreference.format} test on <span className="font-bold underline">{testPreference.topic}</span> is initialized. Assess your depth today.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={startWeeklyTest}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#0c0c1b] font-bold text-xs uppercase tracking-widest transition-all shrink-0"
                  >
                    Initiate Assessment
                  </button>
                </div>
              ) : (
                <div className={`p-5 md:p-6 rounded-3xl border ${isLight ? 'bg-white border-gray-200' : 'bg-white/2 border-white/5'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>Weekly Assessment Schedule</h4>
                      <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-white/60'} mt-1`}>
                        Configured for every <span className="font-semibold text-violet-400">{testPreference.weekday}</span> • Count-down: <span className="font-bold text-lg text-indigo-400">{getDaysUntilTest()}</span> days remaining.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Device Push Alerts</label>
                    <button
                      onClick={toggleOptInAlerts}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-250 ${optInAlerts ? 'bg-indigo-600' : 'bg-gray-400/30'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-250 ${optInAlerts ? 'transform translate-x-5' : ''}`}></span>
                    </button>
                  </div>
                </div>
              )}

              {/* ACTIVE RUNNING TEST WORKSPACE */}
              {activeTest ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-6 md:p-8 rounded-3xl border ${
                    isLight ? 'bg-white border-gray-200 shadow-md text-gray-900' : 'bg-[#0d0d1b] border-white/5 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-4 mb-6 opacity-80">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c0c1d] dark:text-gray-300">
                      Wise Guru Assessment Panel ({activeTest.format.toUpperCase()} MODE)
                    </span>
                    <button
                      onClick={() => setActiveTest(null)}
                      className="text-xs font-bold text-red-400 hover:text-red-500 uppercase tracking-widest"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div className="mb-6 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Socratic Proposal Context</span>
                      <button
                        onClick={() => speakQuestion(activeTest.questionText)}
                        type="button"
                        className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all flex items-center gap-1 text-xs font-bold"
                        title="Read Question Aloud"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Speak</span>
                      </button>
                    </div>
                    <p className="text-base md:text-lg font-serif italic leading-relaxed text-[#1d1d2b] dark:text-sky-100">
                      {activeTest.questionText}
                    </p>
                  </div>

                  {activeTest.result ? (
                    /* Socratic grading layout result */
                    <div className="space-y-6 animate-fade-in">
                      <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl font-black text-emerald-400">{activeTest.result.score}</span>
                        </div>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Concept Mastery Quotient</h4>
                        <p className={`text-xs mt-2 max-w-md mx-auto ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                          The AI Evaluator has compiled your socratic review based on strict physical constants and logic coherence bounds.
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-gray-500/10 border border-gray-500/20">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 block mb-3">Guru Socratic Critique</span>
                        <div className="markdown-body text-xs md:text-sm leading-relaxed prose dark:prose-invert">
                          <ReactMarkdown>{activeTest.result.feedback}</ReactMarkdown>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setActiveTest(null);
                          confetti({ particleCount: 50, spread: 60 });
                        }}
                        className="w-full py-4 bg-violet-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-violet-600/20"
                      >
                        Conclude Weekly Review
                      </button>
                    </div>
                  ) : (
                    /* User drafting answer */
                    <div className="space-y-4">
                      {activeTest.format === 'oral' ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center bg-sky-500/5 rounded-xl px-4 py-2 border border-sky-500/10">
                            <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 animate-pulse">
                              <Mic className="w-4 h-4" />
                              {isRecordingVoice ? (
                                <span>Capturing response via mic... speak clearly!</span>
                              ) : (
                                <span>Microphone idle. Capture voice responses dynamically.</span>
                              )}
                            </span>
                            {isRecordingVoice ? (
                              <button
                                onClick={stopSpeechRecognition}
                                className="px-3 py-1 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase"
                              >
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={startSpeechRecognition}
                                className="px-3 py-1 bg-sky-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-sky-500"
                              >
                                Record Voice
                              </button>
                            )}
                          </div>
                          {voiceTranscript && (
                            <p className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs italic opacity-80">
                              Interim voice feed: "{voiceTranscript}"
                            </p>
                          )}
                        </div>
                      ) : null}

                      <textarea
                        required
                        value={activeTest.response}
                        onChange={(e) => setActiveTest(prev => prev ? { ...prev, response: e.target.value } : null)}
                        rows={6}
                        placeholder={
                          activeTest.format === 'oral'
                            ? "Draw insights of the conceptual elements. You can use the mic recorder above or type response logic here..."
                            : "Draft your essay response. State logical proofs, science constants, or processes to answer the Socratic query comprehensively..."
                        }
                        className={`w-full bg-[#080815] dark:bg-black border border-white/10 rounded-2xl p-4 text-sm focus:border-violet-500/50 outline-none font-sans text-sky-100 ${
                          isLight ? 'bg-gray-50 border-gray-300 text-black' : ''
                        }`}
                      />

                      <button
                        onClick={submitWeeklyTest}
                        disabled={activeTest.isSubmitting || !activeTest.response.trim()}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-rose-600 text-white text-xs font-bold uppercase tracking-widest shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {activeTest.isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Computing Logic Matrix...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Send Draft to Grader</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Static schedule settings */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Settings configurator */}
                  <div className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-gray-200' : 'bg-white/2 border-white/5'} space-y-4 lg:col-span-1`}>
                    <h3 className={`text-base font-bold uppercase tracking-widest ${isLight ? 'text-gray-900' : 'text-white'}`}>Assessment Config</h3>
                    
                    <div>
                      <label className="block text-[9px] font-bold uppercase opacity-60 tracking-wider mb-2">Subject Topic Matter</label>
                      <input
                        type="text"
                        value={testPreference.topic}
                        onChange={(e) => setTestPreference(prev => ({ ...prev, topic: e.target.value }))}
                        className={`w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none ${isLight ? 'bg-gray-100 text-black border-gray-300' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase opacity-60 tracking-wider mb-2">Scheduling Day (Weekly)</label>
                      <select
                        value={testPreference.weekday}
                        onChange={(e) => setTestPreference(prev => ({ ...prev, weekday: e.target.value }))}
                        className={`w-full bg-[#0d0d1c] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none ${isLight ? 'bg-gray-100 text-black border-gray-300' : ''}`}
                      >
                        {weekdayOptions.map(day => (
                          <option key={day} value={day} className="bg-[#0c0c1b] text-white">{day}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold uppercase opacity-60 tracking-wider mb-2">Examination Medium</label>
                      <div className="flex gap-2">
                        {['oral', 'written'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setTestPreference(prev => ({ ...prev, format: f as any }))}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                              testPreference.format === f ? 'bg-rose-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                          >
                            {f === 'oral' ? '🎙️ Oral Presentation' : '📝 Written Essay'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={startWeeklyTest}
                      className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all active:scale-95"
                    >
                      Start Challenge Now
                    </button>
                  </div>

                  {/* Test history dashboard logs */}
                  <div className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-gray-200' : 'bg-white/2 border-white/5'} lg:col-span-2 space-y-4`}>
                    <h3 className={`text-base font-bold uppercase tracking-widest ${isLight ? 'text-gray-900' : 'text-white'}`}>Historical Socratic Reports</h3>

                    {weeklyTestHistory.filter(t => t.uid === (user?.uid || 'anonymous')).length === 0 ? (
                      <div className="text-center py-10 opacity-40">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                        <p className="text-xs italic">No weekly reports computed yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                        {weeklyTestHistory
                          .filter(t => t.uid === (user?.uid || 'anonymous'))
                          .map((t) => (
                            <div
                              key={t.id}
                              className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                                isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/3 border-white/5'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                                    t.format === 'oral' ? 'bg-sky-500/10 text-sky-450 border border-sky-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                  }`}>
                                    {t.format}
                                  </span>
                                  <span className="text-[10px] opacity-40">{new Date(t.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h4 className="text-xs font-bold uppercase mt-1.5">{t.topic}</h4>
                                <p className="text-[10px] opacity-65 line-clamp-1 mt-0.5 italic">Question: {t.questionText}</p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className={`px-3 py-1.5 rounded-lg text-center ${
                                  t.score >= 85 ? 'bg-emerald-500/20 text-emerald-400' :
                                  t.score >= 70 ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  <span className="text-sm font-black">{t.score}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    alert(`--- SOCRATIC FEEDBACK FOR ${t.topic.toUpperCase()} ---\nScore: ${t.score}/100\nFormat: ${t.format}\n\n[PROMPT]:\n${t.questionText}\n\n[YOUR RESPONSE]:\n${t.userResponse}\n\n[CRITIQUE]:\n${t.feedback}`);
                                  }}
                                  className="p-1 px-2.5 bg-white/5 border border-white/5 hover:bg-white/15 text-[9px] font-bold uppercase text-white rounded-md transition-all"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activePracticeTab === 'groups' && (
            <div className="space-y-6 w-full">
              {activeGroup ? (
                /* INSIDE OPEN ACTIVE STUDY GROUP WORKSPACE */
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-gray-200 text-gray-900 shadow-md' : 'bg-[#0d0d1b] border-white/5 text-white'}`}
                >
                  {/* Workspace title header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[8px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                          Active Circle Workspace
                        </span>
                        <span className="text-xs text-gray-400">Created by {activeGroup.createdByAuthor}</span>
                      </div>
                      <h3 className="text-xl font-serif font-black tracking-wide mt-1.5">{activeGroup.title}</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">{activeGroup.description}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => leaveStudyGroup(activeGroup)}
                        className="px-3.5 py-2 rounded-xl bg-red-650/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        🚪 Disconnect Circle
                      </button>
                      <button
                        onClick={() => setActiveGroup(null)}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        ← Lobby
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Circle Notes Chat feed */}
                    <div className="lg:col-span-2 flex flex-col h-[400px] justify-between p-4 bg-black/20 dark:bg-black/40 rounded-2xl border border-white/5">
                      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 pb-3">
                        <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-[10px] italic text-[#1c1c1a] dark:text-sky-200 tracking-wide text-center">
                          🔒 Real-time encrypted channel active. Study guides & links synced automatically.
                        </div>

                        {(activeGroup.sharedNotes || []).map((note: any, nIdx: number) => {
                          const isGuru = note.sender === 'Vigyan Guru Bot';
                          return (
                            <div key={nIdx} className="space-y-1">
                              <div className="flex items-center gap-2 opacity-60">
                                <span className="text-[9px] font-bold uppercase tracking-tighter text-sky-400">{note.sender}</span>
                                {note.createdAt && (
                                  <span className="text-[7px]">
                                    {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className={`p-3 rounded-xl text-xs max-w-lg leading-relaxed ${
                                isGuru 
                                  ? 'bg-violet-900/10 border border-violet-500/20 text-violet-300'
                                  : note.sender === user?.username
                                    ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-250 self-end ml-auto'
                                    : 'bg-white/5 text-gray-200 dark:text-gray-100'
                              }`}>
                                {note.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 border-t pt-3">
                        <input
                          type="text"
                          value={groupNoteText}
                          onChange={(e) => setGroupNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && postGroupNote()}
                          placeholder="Type notes, ask ideas, study questions..."
                          className="flex-1 bg-black text-white text-xs rounded-xl px-4 py-3 outline-none border border-white/10 focus:border-emerald-500/50"
                        />
                        <button
                          onClick={postGroupNote}
                          className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-all text-white flex items-center justify-center shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Left Column side info */}
                    <div className="space-y-4">
                      {/* Shared resources list */}
                      <div className={`p-4 rounded-2xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/2 border-white/5'} space-y-3`}>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#0c0c1b] dark:text-sky-300">Circle Scholars</h4>
                        <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                          {(activeGroup.members || []).map((m: any, mIdx: number) => (
                            <div key={mIdx} className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                              <span className="text-xs font-semibold">{m.username}</span>
                              <span className="text-[9px] opacity-40 truncate">({m.email})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Cooperative study tip */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/25">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block mb-1">Peer Review Tip</span>
                        <p className={`text-[10px] leading-relaxed opacity-75 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                          Working with friends boosts recall by 40%. Share your active Quizzes in the chat panel above to test each other during group conferences!
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* CIRCLES LOBBY VIEW */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                    <div>
                      <h3 className={`text-base font-bold uppercase tracking-widest ${isLight ? 'text-gray-900' : 'text-white'}`}>Active Student Circles</h3>
                      <p className="text-[10px] opacity-60 mt-1 uppercase tracking-wider">Join cooperative groups, share live research whiteboard logs.</p>
                    </div>

                    <button
                      onClick={() => setIsCreatingGroup(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      + Create Circle
                    </button>
                  </div>

                  {/* Circle search */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchGroupQuery}
                      onChange={(e) => setSearchGroupQuery(e.target.value)}
                      placeholder="Search study groups by topic or scholars..."
                      className={`w-full bg-[#080815] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500/50 text-white ${
                        isLight ? 'bg-white text-black border-gray-300' : ''
                      }`}
                    />
                  </div>

                  {/* Create Circle block drawer */}
                  {isCreatingGroup && (
                    <motion.form
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onSubmit={createStudyGroup}
                      className={`p-5 rounded-2xl border space-y-4 ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/2 border-white/5'}`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-emerald-500 uppercase tracking-widest">Setup Study Circle</span>
                        <button type="button" onClick={() => setIsCreatingGroup(false)} className="text-red-400">✕ Close</button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Circle Title (e.g. Thermodynamics Team)"
                          value={newGroupTitle}
                          onChange={(e) => setNewGroupTitle(e.target.value)}
                          className={`w-full bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500/50 text-white ${
                            isLight ? 'bg-white text-black border-gray-300' : ''
                          }`}
                        />
                        <input
                          type="text"
                          placeholder="Goal/Topic Focus"
                          value={newGroupDesc}
                          onChange={(e) => setNewGroupDesc(e.target.value)}
                          className={`w-full bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500/50 text-white ${
                            isLight ? 'bg-white text-black border-gray-300' : ''
                          }`}
                        />
                      </div>

                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                      >
                        Create Group
                      </button>
                    </motion.form>
                  )}

                  {/* Circles list bento grid */}
                  {studyGroups.length === 0 ? (
                    <div className="text-center py-12 bg-[#080812] rounded-3xl opacity-40">
                      <Users className="w-10 h-10 mx-auto mb-2 text-gray-500" />
                      <p className="text-xs italic">No study groups online yet. Be the first to initiate one!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {studyGroups
                        .filter((g) => {
                          const queryLower = searchGroupQuery.toLowerCase();
                          return g.title.toLowerCase().includes(queryLower) || g.description.toLowerCase().includes(queryLower);
                        })
                        .map((g) => {
                          const isMember = user && g.members.some((m: any) => m.uid === user.uid);
                          return (
                            <div
                              key={g.id}
                              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                                isLight ? 'bg-white border-gray-200 shadow-sm text-gray-900' : 'bg-white/3 border-white/5 text-white'
                              }`}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
                                    {g.members?.length || 1} Scholars Online
                                  </span>
                                  {isMember && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-wider border border-emerald-500/30">
                                      ✓ Joined
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-serif font-bold tracking-tight">{g.title}</h4>
                                <p className={`text-xs mt-1.5 opacity-65 ${isLight ? 'text-gray-600' : 'text-white/60'}`}>{g.description}</p>
                              </div>

                              <div className="mt-6 pt-4 border-t border-gray-200/40 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[8px] opacity-40">by {g.createdByAuthor}</span>
                                <button
                                  onClick={() => joinStudyGroup(g)}
                                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    isMember
                                      ? 'bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                                      : 'bg-indigo-600 hover:bg-indigo-505 text-white'
                                  }`}
                                >
                                  {isMember ? 'Open Workspace' : 'Join Circle'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContact = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden overflow-y-auto custom-scrollbar pb-32">
      <div className={`absolute inset-0 bg-gradient-to-br ${isLight ? 'from-violet-200/20 via-transparent to-amber-200/20' : 'from-violet-600/5 via-transparent to-amber-600/5'} pointer-events-none`}></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-xl w-full border rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 shadow-2xl relative z-10 my-8 backdrop-blur-xl ${
          isLight ? 'bg-white/90 border-gray-200' : 'bg-white/5 border-white/10 ring-1 ring-white/5'
        }`}
      >
        {contactSubmitted ? (
          <div className="text-center py-12">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border ${
                isLight 
                  ? 'bg-green-50 border-green-200 shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
                  : 'bg-green-500/20 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
              }`}
            >
              <CheckCircle2 className={`w-10 h-10 ${isLight ? 'text-green-600' : 'text-green-400'}`} />
            </motion.div>
            <h2 className={`text-3xl font-serif italic mb-4 ${isLight ? 'text-gray-900' : 'text-white'}`}>Inquiry Received.</h2>
            <p className={`leading-relaxed max-w-sm mx-auto mb-8 ${isLight ? 'text-gray-600' : 'text-white/60'}`}>
              The Engineering Team has received your transmission. Our architects will contact you shortly to discuss your project.
            </p>
            <button 
              onClick={() => {
                setContactSubmitted(false);
                setActivePage('home');
              }}
              className={`px-8 py-3 border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                isLight 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200 shadow-sm' 
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
              }`}
            >
              Return to Hub
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 border ${
                isLight ? 'bg-violet-50 border-violet-200 text-violet-600 shadow-inner' : 'bg-violet-600/20 border-violet-500/30 text-violet-400'
              }`}>
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className={`text-3xl font-serif italic mb-2 ${isLight ? 'text-gray-950' : 'text-white'}`}>Connect with the Architect</h2>
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
                Inquiry Sensor Initialized
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`block text-[10px] font-black uppercase tracking-widest ml-4 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Full Name</label>
                  <input 
                    type="text"
                    name="name"
                    required
                    className={`w-full px-6 py-4 border rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 outline-none transition-all ${
                      isLight 
                        ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white' 
                        : 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:bg-white/[0.08]'
                    }`}
                    placeholder="Arya Sharma"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`block text-[10px] font-black uppercase tracking-widest ml-4 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Vidyalaya / Email</label>
                  <input 
                    type="email"
                    name="email"
                    required
                    className={`w-full px-6 py-4 border rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 outline-none transition-all ${
                      isLight 
                        ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white' 
                        : 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:bg-white/[0.08]'
                    }`}
                    placeholder="student@vidyalaya.in"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-[10px] font-black uppercase tracking-widest ml-4 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Subject</label>
                <input 
                  type="text"
                  name="subject"
                  required
                  className={`w-full px-6 py-4 border rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 outline-none transition-all ${
                    isLight 
                      ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white' 
                      : 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:bg-white/[0.08]'
                  }`}
                  placeholder="Project Collaboration Inquiry"
                />
              </div>

              <div className="space-y-2">
                <label className={`block text-[10px] font-black uppercase tracking-widest ml-4 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Message</label>
                <textarea 
                  name="message"
                  required
                  rows={4}
                  className={`w-full px-6 py-4 border rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 outline-none resize-none transition-all ${
                    isLight 
                      ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white' 
                      : 'bg-white/5 border-white/10 text-white placeholder-white/20 focus:bg-white/[0.08]'
                  }`}
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

            <div className={`mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
              <p className={`text-[9px] uppercase tracking-widest ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Powered by Formspree Relay</p>
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
  const isLight = theme === 'light';
  return (
    <div className={`h-[100dvh] ${isLight ? 'bg-[#f5f7fb] text-gray-900 border-gray-100' : 'bg-[#020205] text-white border-white/5'} font-sans selection:bg-violet-500/30 selection:text-white relative overflow-hidden flex flex-col transition-colors duration-300`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {isLight ? (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-200/40 blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-100/35 blur-[120px]"></div>
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-150/30 blur-[100px]"></div>
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/20 blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-900/10 blur-[120px]"></div>
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-900/15 blur-[100px]"></div>
          </>
        )}
      </div>

      <header className={`h-16 md:h-20 flex items-center justify-between px-4 md:px-8 border-b ${
        isLight ? 'border-gray-200 bg-white/70 text-gray-950' : 'border-white/10 bg-white/5 text-white'
      } backdrop-blur-md z-50 transition-colors duration-300`}>
        <div className="flex items-center gap-3 md:gap-4 cursor-pointer" onClick={() => setActivePage('home')}>
          <Logo size="sm" />
          <div className="hidden sm:block">
            <h1 className="text-base md:text-lg font-bold tracking-tight uppercase">Vigyan Guru</h1>
            <p className={`text-[8px] md:text-[10px] uppercase tracking-[0.2em] ${isLight ? 'text-gray-500' : 'text-white/40'}`}>Science Guru • Project Guide</p>
          </div>
          <div className="block sm:hidden">
            <h1 className="text-sm font-bold tracking-tight uppercase">V. Guru</h1>
          </div>
        </div>
          <div className="flex gap-2 md:gap-4 items-center animate-fade-in">
            {/* Contact Support Button */}
            <button
              onClick={() => setActivePage('contact')}
              className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${
                activePage === 'contact'
                  ? 'bg-violet-600 text-white border border-violet-500 shadow-md shadow-violet-600/15'
                  : isLight 
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 shadow-sm' 
                    : 'bg-white/5 hover:bg-white/12 text-white/80 border border-white/5'
              }`}
              title="Connect with Architect Support"
              type="button"
            >
              <MessageSquare className={`w-4 h-4 ${activePage === 'contact' ? 'text-white' : 'text-violet-500 dark:text-violet-400'}`} />
              <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest px-1">Contact</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center ${
                isLight 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 shadow-sm' 
                  : 'bg-white/5 hover:bg-white/12 text-white/80 border border-white/5'
              }`}
              title={isLight ? "Change Canopy to Deep Cosmos" : "Illuminate Solar Prismatic Day"}
              type="button"
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {user ? (
              <div className="flex gap-2 md:gap-4 items-center">
                <div className={`border rounded-full px-3 py-1.5 md:px-4 md:py-2 flex items-center gap-2 md:gap-3 ${
                  isLight ? 'bg-gray-50/80 border-gray-200/90 text-gray-900' : 'bg-white/5 border-white/10 text-white'
                }`}>
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                    <Star className="w-3 md:w-3.5 h-3 md:h-3.5 text-violet-500 fill-violet-500" />
                  </div>
                  <span className={`text-xs md:text-sm font-bold truncate max-w-[60px] md:max-w-none uppercase tracking-tighter ${
                    isLight ? 'text-violet-700 font-extrabold' : 'text-violet-300'
                  }`}>
                    {user.username}
                  </span>
                  <div className={`h-4 w-[1px] hidden md:block ${isLight ? 'bg-gray-200' : 'bg-white/10'}`}></div>
                  <span className="text-sky-500 text-xs md:text-sm font-bold hidden md:block">Scholar Lvl 1</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className={`p-1.5 md:p-2 hover:text-red-400 transition-colors ${isLight ? 'text-gray-400' : 'text-white/20'}`}
                >
                  <History className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setActivePage('auth')}
                className="px-4 py-2 md:px-5 md:py-2 bg-violet-600 text-white text-xs md:text-sm font-bold rounded-xl hover:bg-violet-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-violet-600/20"
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
        {activePage === 'practice' && (user ? renderPractice() : renderAuth())}
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
          background: ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)'};
        }
      `}} />
    </div>
  );
}
