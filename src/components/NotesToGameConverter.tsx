import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  Clock, 
  ArrowRight, 
  Check, 
  X, 
  ChevronRight, 
  Zap, 
  AlertCircle, 
  LogOut, 
  Trophy, 
  Brain, 
  RefreshCw,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Undo
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NotesToGameConverterProps {
  user: { uid: string; email: string | null; displayName: string | null; username: string } | null;
  isLight: boolean;
}

interface Question {
  question: string;
  options: string[];
  correctAnswerIdx: number;
  explanation: string;
  keyFact: string;
}

interface GameSession {
  title: string;
  questions: Question[];
  currentQuestionIdx: number;
  timerDuration: number; // 0 for unlimited, or 15, 25, 40
  score: number;
  answersHistory: {
    questionIdx: number;
    selectedIdx: number | null;
    isCorrect: boolean;
    timeTaken: number;
  }[];
  status: 'playing' | 'completed';
}

export function NotesToGameConverter({ user, isLight }: NotesToGameConverterProps) {
  // Screen views: 'dashboard' | 'game'
  const [viewState, setViewState] = useState<'dashboard' | 'playing' | 'completed'>('dashboard');
  
  // Custom states for generator
  const [notesText, setNotesText] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(8);
  const [timerDuration, setTimerDuration] = useState<number>(25); // 0 = unlimited
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Active Game State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(25);
  const [gameTitle, setGameTitle] = useState('Study Session Trivia');
  
  // Review answers log
  const [reviewLogs, setReviewLogs] = useState<{
    question: Question;
    selectedIdx: number | null;
    isCorrect: boolean;
  }[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer logic
  useEffect(() => {
    if (viewState !== 'playing' || timerDuration === 0 || hasSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeExpiration();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewState, currentIdx, timerDuration, hasSubmitted]);

  // Handle when timer runs out
  const handleTimeExpiration = () => {
    setSelectedAns(null);
    setHasSubmitted(true);
    
    // Add to review logs
    const currentQ = questions[currentIdx];
    setReviewLogs(prev => [...prev, {
      question: currentQ,
      selectedIdx: null,
      isCorrect: false
    }]);
  };

  // Answer selection callback
  const handleSelectAnswer = (index: number) => {
    if (hasSubmitted) return;

    setSelectedAns(index);
    setHasSubmitted(true);
    
    const currentQ = questions[currentIdx];
    const isCorrect = index === currentQ.correctAnswerIdx;
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Append to review logs
    setReviewLogs(prev => [...prev, {
      question: currentQ,
      selectedIdx: index,
      isCorrect
    }]);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Proceed to next question or complete game
  const handleNextStep = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      // Game ended
      setViewState('completed');
      
      // Trigger beautiful confetti animation for accomplishment
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else {
      // Load next question
      setCurrentIdx(nextIdx);
      setSelectedAns(null);
      setHasSubmitted(false);
      setTimeLeft(timerDuration);
    }
  };

  // Convert notes text into a clean quiz game via AI GPT endpoint
  const handleGameGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesText.trim() || notesText.trim().length < 20) {
      setErrorMsg('Pasted study notes are too short. Please provide at least 20 characters of information.');
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);
    setGenerationStep('Synthesizing notes and extracting key concepts...');

    try {
      const systemInstruction = `You are Vigyan Guru, a helpful academic analyzer.
      Review the pasted notes and identify exactly ${questionCount} of the most critical facts, concepts, mechanisms, historic dates, formulas, or terms.
      For each of these facts, construct ONE high-quality multiple choice question. It must be highly engaging, educational, and non-trivial.
      
      Provide a response STRICTLY in JSON format following this exact schema:
      {
        "title": "A highly punchy, descriptive game title (e.g., Photosynthesis Frenzy, Newton's Laws Challenge)",
        "questions": [
          {
            "question": "A clear, beautifully phrased multiple choice question testing the concept",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswerIdx": <integer index from 0 to 3 of the correct option>,
            "explanation": "A Socratic explanation detailing why this option is correct and why other choices fall short",
            "keyFact": "The core fact or concept from the notes that triggered this question"
          }
        ]
      }

      Do NOT wrap response in any markdown symbols except raw text or standard \`\`\`json. Output nothing else than the valid parsed JSON object.`;

      const contents = [
        { 
          role: 'user', 
          parts: [{ text: `Here are my academic study notes. Extract concepts and generate a custom single player Socratic challenge game:\n\n${notesText}` }] 
        }
      ];

      setGenerationStep('Submitting Socratic request to Vigyan Guru backend endpoint...');
      
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction,
          model: "gemini-3.5-flash",
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error("Unable to contact the AI Study generator. Please verify your system's online status.");
      }

      setGenerationStep('Parsing scientific facts and building visual game interface...');
      const resData = await response.json();
      const rawText = resData.text || "";
      const cleanStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let parsedGame;
      try {
        parsedGame = JSON.parse(cleanStr);
      } catch (err) {
        console.error("Failed to parse AI response as JSON", rawText);
        throw new Error("Socratic synthesis returned an unformatted response. Please try clicking generate again.");
      }

      if (!parsedGame.questions || !Array.isArray(parsedGame.questions) || parsedGame.questions.length === 0) {
        throw new Error("AI returned an incomplete layout. No playable questions were detected.");
      }

      // Initialize Game state
      setQuestions(parsedGame.questions);
      setGameTitle(parsedGame.title || 'Study Session Trivia');
      setCurrentIdx(0);
      setScore(0);
      setSelectedAns(null);
      setHasSubmitted(false);
      setTimeLeft(timerDuration);
      setReviewLogs([]);

      // Transition screen state
      setViewState('playing');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during AI conversion.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Exit active gameplay loop back to entry panel
  const handleExitGame = () => {
    if (viewState === 'playing' && !window.confirm('Are you sure you want to end this study session? Your score progress will be lost.')) {
      return;
    }
    setViewState('dashboard');
  };

  return (
    <div className={`mt-6 w-full ${isLight ? 'bg-[#f8f9fc]' : 'bg-[#04040a]'}`}>
      <AnimatePresence mode="wait">
        
        {/* --- DASHBOARD ENTRY SCREEN --- */}
        {viewState === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-4xl mx-auto"
          >
            <div className={`p-6 md:p-8 rounded-3xl border ${
              isLight ? 'bg-white border-gray-200 text-gray-950 shadow-sm' : 'bg-white/2 border-white/5 text-white'
            } transition-all`}>
              
              {/* Socratic Header Block */}
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-violet-600/10 text-violet-500 rounded-2xl">
                  <Brain className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Convert Notes to Study Game</h3>
                  <p className={`text-xs opacity-60 mt-0.5 ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                    Paste your raw lectures, books, wiki articles, or study sheets. Vigyan Guru will extract facts to generate a personalized single-player Socratic trivia deck instantly!
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2.5 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs mb-6">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleGameGeneration} className="space-y-6">
                
                {/* Notes Input Area */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-75">
                    Your Subject Notes or Study Material
                  </label>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Paste lectures here... e.g. Mitochondria are the powerhouse of the cell, generating adenosine triphosphate (ATP) via the citric acid cycle. They contain their own bacterial-like genome and replicate autonomously."
                    required
                    rows={8}
                    className={`w-full px-5 py-4 border rounded-2xl text-sm transition-all focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none ${
                      isLight ? 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400' : 'bg-white/5 border-white/10 text-white placeholder-white/25'
                    }`}
                  ></textarea>
                  <div className="flex justify-between text-[11px] opacity-50 mt-1.5 font-mono">
                    <span>Characters: {notesText.length}</span>
                    <span>Min length target: 20 chars</span>
                  </div>
                </div>

                {/* Socratic Parameter Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Select size of game */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2.5 opacity-75">
                      Question Count
                    </label>
                    <div className="flex gap-2">
                      {[5, 8, 12, 15].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuestionCount(num)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            questionCount === num 
                              ? 'bg-violet-600 border-violet-500 text-white font-extrabold shadow-md shadow-violet-500/20' 
                              : isLight 
                                ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100' 
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {num} Qs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select seconds allowed */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2.5 opacity-75">
                      Timer Per Fact
                    </label>
                    <div className="flex gap-2">
                      {[0, 15, 25, 40].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setTimerDuration(sec)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            timerDuration === sec 
                              ? 'bg-sky-600 border-sky-500 text-white font-extrabold shadow-md shadow-sky-500/20' 
                              : isLight 
                                ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100' 
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {sec === 0 ? 'No Timer' : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-sm rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-55 cursor-pointer shadow-lg shadow-violet-600/15"
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{generationStep}</span>
                    </div>
                  ) : (
                    <>
                      <span>Synthesize trivia game deck!</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {isGenerating && (
                <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs text-center animate-pulse">
                  ⚡ Vigyan Guru is synthesizing facts dynamically to formulate a high-yield learning session.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* --- PLAYING GAME SCREEN --- */}
        {viewState === 'playing' && questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-3xl mx-auto space-y-4"
          >
            {/* Top Stat Bar */}
            <div className={`p-4 md:p-6 rounded-3xl border flex items-center justify-between gap-4 ${
              isLight ? 'bg-white border-gray-200 shadow-sm text-gray-950' : 'bg-white/2 border-white/5 text-white'
            }`}>
              <div>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <h4 className="text-sm font-black font-serif italic truncate mt-0.5 max-w-[280px] sm:max-w-md block">
                  {gameTitle}
                </h4>
              </div>

              {/* Score and Dynamic Timer Display */}
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <span className="text-[9px] uppercase font-black opacity-40 block">Correct score</span>
                  <span className="text-base font-black font-mono text-emerald-400">{score}</span>
                </div>
                
                {timerDuration > 0 && (
                  <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                    <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
                    <span className="text-xl font-mono font-black text-sky-400">{timeLeft}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Interactive Question Card */}
            <div className={`p-6 md:p-8 rounded-3xl border ${
              isLight ? 'bg-white border-gray-200 text-gray-950 shadow-sm' : 'bg-white/2 border-white/5 text-white'
            }`}>
              
              {/* Progress Indicator line */}
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-gradient-to-r from-violet-600 to-sky-500 transition-all duration-300"
                  style={{ width: `${((currentIdx + (hasSubmitted ? 1 : 0)) / questions.length) * 100}%` }}
                ></div>
              </div>

              {/* The Question Text */}
              <h2 className="text-lg md:text-xl font-bold leading-relaxed mb-6 font-serif">
                {questions[currentIdx].question}
              </h2>

              {/* Response Options Grid */}
              <div className="grid grid-cols-1 gap-3.5">
                {questions[currentIdx].options.map((option, i) => {
                  const isSelected = selectedAns === i;
                  const isCorrectAnswer = i === questions[currentIdx].correctAnswerIdx;
                  
                  // Visual decorators
                  let optionStyles = isLight 
                    ? 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800' 
                    : 'bg-white/2 border-white/5 text-white hover:bg-white/5';
                  
                  if (isSelected && !hasSubmitted) {
                    optionStyles = 'bg-violet-600/10 border-violet-500 text-violet-400 font-extrabold';
                  }

                  if (hasSubmitted) {
                    if (isCorrectAnswer) {
                      optionStyles = 'bg-green-500/10 border-green-500 text-green-400 font-extrabold';
                    } else if (isSelected) {
                      optionStyles = 'bg-rose-500/10 border-rose-500 text-rose-400';
                    } else {
                      optionStyles = 'opacity-35 border-white/5';
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={hasSubmitted}
                      onClick={() => handleSelectAnswer(i)}
                      className={`p-4 md:p-5 rounded-2xl border text-left text-sm font-bold transition-all flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] active:scale-[0.995] ${optionStyles}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-xs font-mono border ${
                          isCorrectAnswer && hasSubmitted
                            ? 'bg-green-500 border-green-400 text-white'
                            : isSelected && hasSubmitted
                              ? 'bg-rose-500 border-rose-400 text-white'
                              : isSelected
                                ? 'bg-violet-500 border-violet-400 text-white'
                                : 'border-white/10 opacity-70'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="leading-snug">{option}</span>
                      </div>

                      {hasSubmitted && isCorrectAnswer && <Check className="w-5 h-5 text-green-400 flex-shrink-0" />}
                      {hasSubmitted && isSelected && !isCorrectAnswer && <X className="w-5 h-5 text-rose-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Socratic Feedback Module Panel */}
              <AnimatePresence>
                {hasSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 pt-6 border-t border-white/10 space-y-4 overflow-hidden"
                  >
                    <div className={`p-4 rounded-2xl border ${
                      isLight ? 'bg-violet-500/5 border-violet-500/10' : 'bg-violet-500/[0.03] border-violet-500/10'
                    }`}>
                      <div className="flex gap-2 items-center text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Socratic Explanation</span>
                      </div>
                      <p className={`text-xs leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        {questions[currentIdx].explanation}
                      </p>
                    </div>

                    <div className="flex gap-2 items-center text-[10px] font-mono opacity-50 px-2">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">Concept Key:</span>
                      <span className="truncate">{questions[currentIdx].keyFact}</span>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleNextStep}
                        className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-md shadow-violet-500/10"
                      >
                        <span>{currentIdx + 1 === questions.length ? 'Finish & See Results' : 'Next Question'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Backout Exit Options */}
            <div className="flex justify-between items-center px-2">
              <button
                onClick={handleExitGame}
                className="text-[10px] font-black uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Abort Study Session</span>
              </button>
              
              {!hasSubmitted && timerDuration > 0 && (
                <span className="text-[10px] font-mono opacity-40">
                  Select answer card before time expires!
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* --- COMPLETED SUMMARY SCREEN --- */}
        {viewState === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl mx-auto"
          >
            <div className={`p-8 md:p-10 rounded-3xl border text-center ${
              isLight ? 'bg-white border-gray-200 text-gray-950 shadow-sm' : 'bg-white/2 border-white/5 text-white'
            }`}>
              
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 text-white rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10">
                <Trophy className="w-8 h-8 animate-bounce" />
              </div>

              <h2 className="text-3xl font-black font-serif italic mb-2">Subject Mastery Synced!</h2>
              <p className={`text-xs opacity-65 mb-6 max-w-md mx-auto ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                You have successfully run the entire Socratic challenge cycle. Here is your evaluation score card.
              </p>

              {/* Large Score Card */}
              <div className={`inline-flex items-center gap-6 p-6 rounded-2xl border mb-8 ${
                isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/2 border-white/5'
              }`}>
                <div className="text-center pr-6 border-r border-white/10">
                  <span className="block text-[9px] uppercase tracking-widest font-black opacity-40 mb-1">Score Card</span>
                  <span className="text-4xl font-extrabold font-mono text-violet-400">
                    {score}<span className="text-xl text-white/30 font-normal">/{questions.length}</span>
                  </span>
                </div>

                <div className="text-left">
                  <span className="block text-[9px] uppercase tracking-widest font-black opacity-40 mb-1">Final Mark</span>
                  <span className="text-xl font-bold block text-green-400">
                    {Math.round((score / questions.length) * 100)}% Grade
                  </span>
                  <span className="text-[10px] opacity-50">
                    {score === questions.length ? 'Perfect Academic Score!' : score > questions.length / 2 ? 'Strong Fact Catch!' : 'Needs Conceptual Review'}
                  </span>
                </div>
              </div>

              {/* Review Panel of Socratic Facts */}
              <div className="text-left mb-8">
                <h4 className="text-xs font-black uppercase tracking-widest opacity-60 mb-4 flex items-center gap-1.5 px-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Fact-by-Fact Study Log
                </h4>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {reviewLogs.map((log, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        log.isCorrect 
                          ? isLight ? 'bg-green-500/5 border-green-500/10' : 'bg-green-500/[0.02]/5 border-green-500/10'
                          : isLight ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-500/[0.02]/5 border-rose-500/10'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <h5 className="text-xs font-serif font-bold line-clamp-2">
                          Q{idx + 1}: {log.question.question}
                        </h5>
                        <span className={`text-[10px] font-mono uppercase tracking-wider font-extrabold flex-shrink-0 ${log.isCorrect ? 'text-green-400' : 'text-rose-400'}`}>
                          {log.isCorrect ? 'Correct ⚡' : 'Incorrect ❌'}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed opacity-75 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        <strong>Socratic Key:</strong> {log.question.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Options */}
              <div className="flex gap-4 border-t border-white/10 pt-8 justify-center">
                <button
                  onClick={handleExitGame}
                  className="px-6 py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-xs font-bold tracking-widest cursor-pointer uppercase shadow-md shadow-violet-600/15"
                >
                  <span>Build Next Game</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
