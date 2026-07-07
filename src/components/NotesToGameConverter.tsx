import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  Clock, 
  ArrowRight, 
  Check, 
  X, 
  ChevronRight, 
  AlertCircle, 
  LogOut, 
  Trophy, 
  Brain, 
  RefreshCw,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Gamepad2,
  Shuffle,
  Undo2,
  Trash2,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NotesToGameConverterProps {
  user: { uid: string; email: string | null; displayName: string | null; username: string } | null;
  isLight: boolean;
}

// Preset configurations for instant play
const PRESETS = [
  { subject: "Science", class: "Class 7", topic: "Photosynthesis" },
  { subject: "Mathematics", class: "Class 9", topic: "Pythagoras Theorem" },
  { subject: "History", class: "Class 10", topic: "French Revolution" },
  { subject: "Geography", class: "Class 6", topic: "Solar System" }
];

// --- Types for different games ---

interface SpellCheckChallenge {
  word: string; // Correct uppercase spelling
  definition: string; // Kid-friendly/grade-friendly definition
  options: string[]; // 4 spelling options
  correctAnswerIdx: number;
  missingPattern: string; // word with missing letters, e.g., P_OT_SY_TH_S_S
}

interface CrosswordWord {
  word: string; // Uppercase
  clue: string;
  direction: 'ACROSS' | 'DOWN';
  row: number; // 0-based start
  col: number; // 0-based start
}

interface ScrambleChallenge {
  word: string; // Uppercase
  scrambled: string;
  clue: string;
  explanation: string;
}

interface TriviaQuestion {
  question: string;
  options: string[];
  correctAnswerIdx: number;
  explanation: string;
}

export function NotesToGameConverter({ user, isLight }: NotesToGameConverterProps) {
  // Screen views: 'dashboard' | 'playing' | 'completed'
  const [viewState, setViewState] = useState<'dashboard' | 'playing' | 'completed'>('dashboard');

  // Input states
  const [subject, setSubject] = useState('Science');
  const [gradeClass, setGradeClass] = useState('Class 7');
  const [topic, setTopic] = useState('Photosynthesis');
  const [gameType, setGameType] = useState<'spell_check' | 'crossword' | 'scramble' | 'trivia'>('spell_check');

  // Generator states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Loaded Game Data
  const [gameTitle, setGameTitle] = useState('');
  
  // Game states: Spell Check
  const [spellChallenges, setSpellChallenges] = useState<SpellCheckChallenge[]>([]);
  const [spellCurrentIdx, setSpellCurrentIdx] = useState(0);
  const [spellSelectedIdx, setSpellSelectedIdx] = useState<number | null>(null);
  const [spellSubmitted, setSpellSubmitted] = useState(false);
  const [spellScore, setSpellScore] = useState(0);
  const [spellTypeAttempt, setSpellTypeAttempt] = useState('');
  const [spellActiveSubMode, setSpellActiveSubMode] = useState<'mcq' | 'fill'>('mcq');

  // Game states: Crossword
  const [crosswordWords, setCrosswordWords] = useState<CrosswordWord[]>([]);
  const [gridNumbers, setGridNumbers] = useState<{ [key: string]: number }>({}); // "row,col" -> number
  const [wordNumbers, setWordNumbers] = useState<{ [key: number]: number }>({}); // word index -> start number
  const [userGrid, setUserGrid] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')));
  const [crosswordSolved, setCrosswordSolved] = useState(false);
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [crosswordChecked, setCrosswordChecked] = useState(false);

  // Game states: Scramble
  const [scrambleChallenges, setScrambleChallenges] = useState<ScrambleChallenge[]>([]);
  const [scrambleCurrentIdx, setScrambleCurrentIdx] = useState(0);
  const [scrambleScore, setScrambleScore] = useState(0);
  const [scrambleSubmitted, setScrambleSubmitted] = useState(false);
  const [scrambleAttempt, setScrambleAttempt] = useState<string[]>([]); // User's built letters
  const [scramblePool, setScramblePool] = useState<{ letter: string; used: boolean }[]>([]); // Scrambled letter pool with usage flags

  // Game states: Trivia
  const [triviaQuestions, setTriviaQuestions] = useState<TriviaQuestion[]>([]);
  const [triviaCurrentIdx, setTriviaCurrentIdx] = useState(0);
  const [triviaSelectedIdx, setTriviaSelectedIdx] = useState<number | null>(null);
  const [triviaSubmitted, setTriviaSubmitted] = useState(false);
  const [triviaScore, setTriviaScore] = useState(0);

  // General Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerDuration, setTimerDuration] = useState(0); // 0 = no timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Review Logs for completed screen
  const [reviewLogs, setReviewLogs] = useState<{
    title: string;
    description: string;
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string;
  }[]>([]);

  // Apply a preset configuration
  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setSubject(p.subject);
    setGradeClass(p.class);
    setTopic(p.topic);
    setErrorMsg('');
  };

  // --- Start general timer ---
  useEffect(() => {
    if (viewState !== 'playing' || timerDuration === 0) {
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
  }, [viewState, timerDuration, spellCurrentIdx, scrambleCurrentIdx, triviaCurrentIdx]);

  const handleTimeExpiration = () => {
    if (gameType === 'trivia') {
      setTriviaSubmitted(true);
      setReviewLogs(prev => [...prev, {
        title: triviaQuestions[triviaCurrentIdx].question,
        description: triviaQuestions[triviaCurrentIdx].explanation,
        isCorrect: false,
        correctAnswer: triviaQuestions[triviaCurrentIdx].options[triviaQuestions[triviaCurrentIdx].correctAnswerIdx],
        userAnswer: "Time Expired"
      }]);
    } else if (gameType === 'spell_check') {
      setSpellSubmitted(true);
      setReviewLogs(prev => [...prev, {
        title: `Spell check: ${spellChallenges[spellCurrentIdx].word}`,
        description: `Definition: ${spellChallenges[spellCurrentIdx].definition}`,
        isCorrect: false,
        correctAnswer: spellChallenges[spellCurrentIdx].word,
        userAnswer: "Time Expired"
      }]);
    } else if (gameType === 'scramble') {
      setScrambleSubmitted(true);
      setReviewLogs(prev => [...prev, {
        title: `Unscramble: ${scrambleChallenges[scrambleCurrentIdx].word}`,
        description: scrambleChallenges[scrambleCurrentIdx].explanation,
        isCorrect: false,
        correctAnswer: scrambleChallenges[scrambleCurrentIdx].word,
        userAnswer: "Time Expired"
      }]);
    }
  };

  // --- GAME GENERATION ---
  const handleGameGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !gradeClass.trim() || !topic.trim()) {
      setErrorMsg('Please specify Subject, Class, and Topic fields.');
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);
    setGenerationStep('Designing your personalized learning arena...');

    try {
      let systemInstruction = '';
      let responseSchema: any = null;

      if (gameType === 'spell_check') {
        systemInstruction = `Generate a spelling bee game for a student in ${gradeClass} studying ${subject} on the topic "${topic}".
Generate exactly 6 relevant terms related to the topic. For each term, construct a high-quality Spelling challenge.
- word: The correct spelled term (uppercase, e.g., "PHOTOSYNTHESIS").
- definition: Grade-level appropriate scientific or academic definition/hint.
- options: Exactly 4 options containing the correct spelling AND 3 plausible but incorrect spelling variations of the word.
- correctAnswerIdx: The zero-based index of the correct spelling in options (0 to 3).
- missingPattern: The word with approximately 30-50% of its letters replaced by underscores (e.g. "P_OT_SY_TH_S_S").`;

        responseSchema = {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            challenges: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  word: { type: "STRING" },
                  definition: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correctAnswerIdx: { type: "INTEGER" },
                  missingPattern: { type: "STRING" }
                },
                required: ["word", "definition", "options", "correctAnswerIdx", "missingPattern"]
              }
            }
          },
          required: ["title", "challenges"]
        };
      } else if (gameType === 'crossword') {
        systemInstruction = `Construct a mini crossword puzzle for ${gradeClass} studying ${subject} on the topic "${topic}".
Generate exactly 4-5 key terms of 3 to 8 uppercase letters relevant to the topic. 
You must fit these words into an 8x8 grid (rows 0-7, columns 0-7).
Provide the exact coordinates for where each word should start and its direction ("ACROSS" or "DOWN").
Double check your layout to ensure:
- Horizontal words fit: col + word.length <= 8.
- Vertical words fit: row + word.length <= 8.
- Try to make at least two words intersect at a shared letter at the exact same row and column if possible.
All word coordinates must be 0-indexed integer values.`;

        responseSchema = {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            gridSize: { type: "INTEGER" },
            words: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  word: { type: "STRING" },
                  clue: { type: "STRING" },
                  direction: { type: "STRING", enum: ["ACROSS", "DOWN"] },
                  row: { type: "INTEGER" },
                  col: { type: "INTEGER" }
                },
                required: ["word", "clue", "direction", "row", "col"]
              }
            }
          },
          required: ["title", "gridSize", "words"]
        };
      } else if (gameType === 'scramble') {
        systemInstruction = `Generate an interactive Word Scramble challenge for ${gradeClass} studying ${subject} on the topic "${topic}".
Create exactly 6 key terms. For each term:
- word: The correct term in uppercase (e.g., "CHLOROPLAST").
- scrambled: A completely shuffled version of the exact letters of the word (e.g., "TLRHOOPSAC").
- clue: A descriptive Socratic hint or definition helping the student identify the term.
- explanation: A detailed Socratic explanation explaining why this term is essential to the topic.`;

        responseSchema = {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            challenges: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  word: { type: "STRING" },
                  scrambled: { type: "STRING" },
                  clue: { type: "STRING" },
                  explanation: { type: "STRING" }
                },
                required: ["word", "scrambled", "clue", "explanation"]
              }
            }
          },
          required: ["title", "challenges"]
        };
      } else {
        // trivia
        systemInstruction = `Generate a Socratic trivia game deck for ${gradeClass} studying ${subject} on the topic "${topic}".
Provide exactly 5 highly engaging multiple choice questions.
For each question, include exactly 4 plausible options, the correct answer index, and a comprehensive, encouraging Socratic explanation detailing why the correct answer is indeed correct and why other options are incorrect.`;

        responseSchema = {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  correctAnswerIdx: { type: "INTEGER" },
                  explanation: { type: "STRING" }
                },
                required: ["question", "options", "correctAnswerIdx", "explanation"]
              }
            }
          },
          required: ["title", "questions"]
        };
      }

      setGenerationStep('Vigyan Guru is compiling academic facts using Gemini API...');
      
      const contents = [
        { 
          role: 'user', 
          parts: [{ text: `Generate a premium ${gameType} game deck based on Subject: ${subject}, Class: ${gradeClass}, Topic: ${topic}` }] 
        }
      ];

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction,
          model: "gemini-3.5-flash",
          temperature: 0.75,
          responseMimeType: "application/json",
          responseSchema
        })
      });

      if (!response.ok) {
        throw new Error(`Socratic generator returned status ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      const rawText = resData.text || resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      let cleanStr = rawText;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanStr);
      setGameTitle(parsed.title || `${subject} - ${topic} Challenge`);
      setReviewLogs([]);

      // Reset score and state based on Game Type
      if (gameType === 'spell_check') {
        setSpellChallenges(parsed.challenges);
        setSpellCurrentIdx(0);
        setSpellSelectedIdx(null);
        setSpellSubmitted(false);
        setSpellScore(0);
        setSpellTypeAttempt('');
        setSpellActiveSubMode('mcq');
        setTimerDuration(30); // 30 seconds per spelling challenge
        setTimeLeft(30);
      } else if (gameType === 'crossword') {
        // Normalize words and build the interactive crossword board state
        const normalizedWords = (parsed.words || []).map((w: any) => ({
          ...w,
          word: w.word.toUpperCase().replace(/[^A-Z]/g, '')
        }));
        setCrosswordWords(normalizedWords);
        
        // Build starting cell numbers
        const numbers: { [key: string]: number } = {};
        const wordNumMap: { [key: number]: number } = {};
        let currentNum = 1;

        // Sort words by grid start position (row, then col)
        const sortedWithIndices = normalizedWords
          .map((w: any, index: number) => ({ w, index }))
          .sort((a, b) => {
            if (a.w.row !== b.w.row) return a.w.row - b.w.row;
            return a.w.col - b.w.col;
          });

        sortedWithIndices.forEach(({ w, index }) => {
          const key = `${w.row},${w.col}`;
          if (!numbers[key]) {
            numbers[key] = currentNum;
            currentNum++;
          }
          wordNumMap[index] = numbers[key];
        });

        setGridNumbers(numbers);
        setWordNumbers(wordNumMap);

        // Clear user grid (8x8)
        const emptyGrid = Array(8).fill(null).map(() => Array(8).fill(''));
        setUserGrid(emptyGrid);
        setCrosswordSolved(false);
        setCrosswordChecked(false);
        setSelectedWordIdx(0); // Select first word clue
        setTimerDuration(0); // Crossword has no timer
      } else if (gameType === 'scramble') {
        const challenges = (parsed.challenges || []).map((ch: any) => ({
          ...ch,
          word: ch.word.toUpperCase().replace(/[^A-Z]/g, '')
        }));
        setScrambleChallenges(challenges);
        setScrambleCurrentIdx(0);
        setScrambleScore(0);
        setScrambleSubmitted(false);
        setupScramblePool(challenges[0]);
        setTimerDuration(45); // 45 seconds per scramble
        setTimeLeft(45);
      } else {
        // trivia
        setTriviaQuestions(parsed.questions);
        setTriviaCurrentIdx(0);
        setTriviaSelectedIdx(null);
        setTriviaSubmitted(false);
        setTriviaScore(0);
        setTimerDuration(30); // 30 seconds per trivia question
        setTimeLeft(30);
      }

      setViewState('playing');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Unable to parse AI response. Let\'s try generating again!');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- SCRAMBLE GAME SETUP ---
  const setupScramblePool = (challenge: ScrambleChallenge) => {
    const letters = challenge.scrambled.split('');
    setScramblePool(letters.map(l => ({ letter: l, used: false })));
    setScrambleAttempt([]);
  };

  // --- TRIVIA ANSWER SUBMISSION ---
  const handleSelectTriviaAnswer = (idx: number) => {
    if (triviaSubmitted) return;
    setTriviaSelectedIdx(idx);
    setTriviaSubmitted(true);
    
    const isCorrect = idx === triviaQuestions[triviaCurrentIdx].correctAnswerIdx;
    if (isCorrect) {
      setTriviaScore(prev => prev + 1);
    }

    setReviewLogs(prev => [...prev, {
      title: triviaQuestions[triviaCurrentIdx].question,
      description: triviaQuestions[triviaCurrentIdx].explanation,
      isCorrect,
      correctAnswer: triviaQuestions[triviaCurrentIdx].options[triviaQuestions[triviaCurrentIdx].correctAnswerIdx],
      userAnswer: triviaQuestions[triviaCurrentIdx].options[idx]
    }]);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleNextTrivia = () => {
    if (triviaCurrentIdx + 1 >= triviaQuestions.length) {
      setViewState('completed');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
      setTriviaCurrentIdx(prev => prev + 1);
      setTriviaSelectedIdx(null);
      setTriviaSubmitted(false);
      setTimeLeft(30);
    }
  };

  // --- SPELL CHECK ANSWER SUBMISSION ---
  const handleSelectSpellAnswer = (idx: number) => {
    if (spellSubmitted) return;
    setSpellSelectedIdx(idx);
    setSpellSubmitted(true);

    const correctWord = spellChallenges[spellCurrentIdx].word;
    const selectedWord = spellChallenges[spellCurrentIdx].options[idx];
    const isCorrect = idx === spellChallenges[spellCurrentIdx].correctAnswerIdx;

    if (isCorrect) {
      setSpellScore(prev => prev + 1);
    }

    setReviewLogs(prev => [...prev, {
      title: `Spell-Check Match: "${correctWord}"`,
      description: `Clue: ${spellChallenges[spellCurrentIdx].definition}`,
      isCorrect,
      correctAnswer: correctWord,
      userAnswer: selectedWord
    }]);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSubmitSpellFill = () => {
    if (spellSubmitted) return;
    setSpellSubmitted(true);

    const correctWord = spellChallenges[spellCurrentIdx].word.toUpperCase().trim();
    const isCorrect = spellTypeAttempt.toUpperCase().trim() === correctWord;

    if (isCorrect) {
      setSpellScore(prev => prev + 1);
    }

    setReviewLogs(prev => [...prev, {
      title: `Letter-Fill Spell Match: "${correctWord}"`,
      description: `Clue: ${spellChallenges[spellCurrentIdx].definition}`,
      isCorrect,
      correctAnswer: correctWord,
      userAnswer: spellTypeAttempt.toUpperCase() || "[Empty Attempt]"
    }]);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleNextSpell = () => {
    if (spellCurrentIdx + 1 >= spellChallenges.length) {
      setViewState('completed');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
      setSpellCurrentIdx(prev => prev + 1);
      setSpellSelectedIdx(null);
      setSpellSubmitted(false);
      setSpellTypeAttempt('');
      setTimeLeft(30);
    }
  };

  // --- SCRAMBLE GAME LOGIC ---
  const handleScramblePoolLetterClick = (poolIdx: number) => {
    if (scrambleSubmitted) return;
    const letterObj = scramblePool[poolIdx];
    if (letterObj.used) return;

    // Add to attempt array
    setScrambleAttempt(prev => [...prev, letterObj.letter]);
    // Mark as used
    setScramblePool(prev => {
      const copy = [...prev];
      copy[poolIdx] = { ...copy[poolIdx], used: true };
      return copy;
    });
  };

  const handleScrambleAttemptLetterClick = (attemptIdx: number) => {
    if (scrambleSubmitted) return;
    const removedLetter = scrambleAttempt[attemptIdx];

    // Remove from attempt array
    setScrambleAttempt(prev => prev.filter((_, idx) => idx !== attemptIdx));
    // Find first corresponding unused letter in pool and mark as unused
    setScramblePool(prev => {
      const copy = [...prev];
      const matchIdx = copy.findIndex(item => item.letter === removedLetter && item.used);
      if (matchIdx !== -1) {
        copy[matchIdx] = { ...copy[matchIdx], used: false };
      }
      return copy;
    });
  };

  const handleClearScramble = () => {
    if (scrambleSubmitted) return;
    setScrambleAttempt([]);
    setScramblePool(prev => prev.map(item => ({ ...item, used: false })));
  };

  const handleSubmitScramble = () => {
    if (scrambleSubmitted) return;
    setScrambleSubmitted(true);

    const userWord = scrambleAttempt.join('').toUpperCase();
    const correctWord = scrambleChallenges[scrambleCurrentIdx].word;
    const isCorrect = userWord === correctWord;

    if (isCorrect) {
      setScrambleScore(prev => prev + 1);
    }

    setReviewLogs(prev => [...prev, {
      title: `Unscramble Term: "${correctWord}"`,
      description: scrambleChallenges[scrambleCurrentIdx].explanation,
      isCorrect,
      correctAnswer: correctWord,
      userAnswer: userWord || "[Empty Attempt]"
    }]);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleNextScramble = () => {
    if (scrambleCurrentIdx + 1 >= scrambleChallenges.length) {
      setViewState('completed');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
      const nextIdx = scrambleCurrentIdx + 1;
      setScrambleCurrentIdx(nextIdx);
      setScrambleSubmitted(false);
      setupScramblePool(scrambleChallenges[nextIdx]);
      setTimeLeft(45);
    }
  };

  // --- CROSSWORD INTERACTIVE LOGIC ---
  const handleCellChange = (r: number, c: number, value: string) => {
    if (crosswordSolved) return;
    const uppercaseVal = value.toUpperCase().slice(-1); // Take only latest char
    setUserGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = uppercaseVal;
      return copy;
    });

    // Advance focus logically to next cell of active word clue
    if (uppercaseVal && selectedWordIdx !== null) {
      const activeWord = crosswordWords[selectedWordIdx];
      // Find index of current cell in the active word string
      let cellOffset = -1;
      if (activeWord.direction === 'ACROSS' && r === activeWord.row) {
        cellOffset = c - activeWord.col;
      } else if (activeWord.direction === 'DOWN' && c === activeWord.col) {
        cellOffset = r - activeWord.row;
      }

      if (cellOffset !== -1 && cellOffset < activeWord.word.length - 1) {
        const nextOffset = cellOffset + 1;
        const nextR = activeWord.direction === 'DOWN' ? activeWord.row + nextOffset : activeWord.row;
        const nextC = activeWord.direction === 'ACROSS' ? activeWord.col + nextOffset : activeWord.col;
        
        // Use timeout to let DOM render before focusing next element
        setTimeout(() => {
          const el = document.getElementById(`cell-${nextR}-${nextC}`);
          if (el) el.focus();
        }, 10);
      }
    }
  };

  // Check the crossword answers
  const handleCheckCrossword = () => {
    setCrosswordChecked(true);
    let allCorrect = true;
    const logs: typeof reviewLogs = [];

    crosswordWords.forEach((item, index) => {
      let currentWordCorrect = true;
      let buildUserWord = '';

      for (let i = 0; i < item.word.length; i++) {
        const r = item.direction === 'DOWN' ? item.row + i : item.row;
        const c = item.direction === 'ACROSS' ? item.col + i : item.col;
        const userChar = userGrid[r][c] || '';
        buildUserWord += userChar;
        if (userChar !== item.word[i]) {
          currentWordCorrect = false;
          allCorrect = false;
        }
      }

      logs.push({
        title: `${wordNumbers[index] || index + 1} ${item.direction}: ${item.clue}`,
        description: `Vocabulary Word: "${item.word}"`,
        isCorrect: currentWordCorrect,
        correctAnswer: item.word,
        userAnswer: buildUserWord || "[Empty]"
      });
    });

    if (allCorrect) {
      setCrosswordSolved(true);
      setViewState('completed');
      setReviewLogs(logs);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else {
      // Show feedback but keep playing
      alert("⚠️ Some cells are still empty or incorrect. Look for highlighted boxes and try again!");
    }
  };

  const handleRevealSolveCrossword = () => {
    if (window.confirm("Do you want to solve the board automatically and complete the challenge?")) {
      const solutionGrid = Array(8).fill(null).map(() => Array(8).fill(''));
      crosswordWords.forEach(item => {
        for (let i = 0; i < item.word.length; i++) {
          const r = item.direction === 'DOWN' ? item.row + i : item.row;
          const c = item.direction === 'ACROSS' ? item.col + i : item.col;
          solutionGrid[r][c] = item.word[i];
        }
      });
      setUserGrid(solutionGrid);
      setCrosswordSolved(true);
      
      const logs = crosswordWords.map((item, index) => ({
        title: `${wordNumbers[index] || index + 1} ${item.direction}: ${item.clue}`,
        description: `Vocabulary Word: "${item.word}"`,
        isCorrect: true,
        correctAnswer: item.word,
        userAnswer: item.word
      }));
      setReviewLogs(logs);
      setViewState('completed');
    }
  };

  // Helper to determine if a cell coordinate is part of ANY word
  const isPlayableCell = (r: number, c: number) => {
    return crosswordWords.some(item => {
      for (let i = 0; i < item.word.length; i++) {
        const itemR = item.direction === 'DOWN' ? item.row + i : item.row;
        const itemC = item.direction === 'ACROSS' ? item.col + i : item.col;
        if (itemR === r && itemC === c) return true;
      }
      return false;
    });
  };

  // Helper to determine if a cell is correct
  const isCellCorrect = (r: number, c: number) => {
    if (!isPlayableCell(r, c)) return false;
    let answerChar = '';
    // Find expected character
    crosswordWords.forEach(item => {
      for (let i = 0; i < item.word.length; i++) {
        const itemR = item.direction === 'DOWN' ? item.row + i : item.row;
        const itemC = item.direction === 'ACROSS' ? item.col + i : item.col;
        if (itemR === r && itemC === c) {
          answerChar = item.word[i];
        }
      }
    });
    return userGrid[r][c] === answerChar;
  };

  // Exit game session
  const handleExitGame = () => {
    if (viewState === 'playing' && !window.confirm('Are you sure you want to end this game? Your progress will be lost.')) {
      return;
    }
    setViewState('dashboard');
  };

  return (
    <div className={`flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-12 flex flex-col gap-8 custom-scrollbar pb-32`}>
      <div className="max-w-6xl mx-auto w-full">
        
        <AnimatePresence mode="wait">
          
          {/* --- DASHBOARD ENTRY SCREEN --- */}
          {viewState === 'dashboard' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="text-center">
                <span className="inline-block px-4 py-1.5 rounded-full bg-violet-600/10 border border-violet-500/20 text-[10px] font-black uppercase tracking-widest mb-4">
                  Socratic Game Center 🎮
                </span>
                <h2 className="text-3xl md:text-5xl font-serif italic mb-4 leading-tight">Wisdom is Best Gained in Play.</h2>
                <p className={`text-xs md:text-sm max-w-xl mx-auto leading-relaxed ${isLight ? 'text-gray-600' : 'text-white/40'}`}>
                  Choose a subject, class, and specific topic. Vigyan Guru will instantly synthesize custom word puzzles, crossword boards, and spelling bees to test your academic knowledge!
                </p>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(p)}
                    className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isLight 
                        ? 'bg-white border-gray-150 hover:bg-gray-50 text-gray-900 shadow-sm' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-violet-500 dark:text-violet-400 block mb-1">{p.subject} • {p.class}</span>
                    <h4 className="text-xs font-black truncate">{p.topic}</h4>
                  </button>
                ))}
              </div>

              {/* Form and Selection Config */}
              <div className={`p-6 md:p-8 rounded-[2.5rem] border ${
                isLight ? 'bg-white border-gray-150 text-gray-950 shadow-md' : 'bg-white/5 border-white/10 text-white'
              }`}>
                {errorMsg && (
                  <div className="flex items-center gap-2.5 p-4 rounded-2xl text-xs mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleGameGeneration} className="space-y-6">
                  
                  {/* Subject, Class, Topic Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Subject Area</label>
                      <input 
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Science, Mathematics, History"
                        required
                        className={`w-full px-4 py-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 ${
                          isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Class / Grade</label>
                      <input 
                        type="text"
                        value={gradeClass}
                        onChange={(e) => setGradeClass(e.target.value)}
                        placeholder="e.g. Class 7, Grade 10"
                        required
                        className={`w-full px-4 py-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 ${
                          isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Specific Topic</label>
                      <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Photosynthesis, Fractions, French Revolution"
                        required
                        className={`w-full px-4 py-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 ${
                          isLight ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Game Type Cards Selector */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Choose Game Format</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {[
                        { 
                          id: 'spell_check', 
                          title: 'Spell Check Bee 🔠', 
                          desc: 'Test your academic spelling mastery with MCQs and pattern letter fills.' 
                        },
                        { 
                          id: 'crossword', 
                          title: 'Crossword Jam 🧩', 
                          desc: 'Fill an interactive 8x8 crossword matrix with intersecting academic hints.' 
                        },
                        { 
                          id: 'scramble', 
                          title: 'Word Scramble Master 🔀', 
                          desc: 'Rearrange letter pools to form complex vocabulary words with hints.' 
                        },
                        { 
                          id: 'trivia', 
                          title: 'Trivia Socratic Quiz 🧠', 
                          desc: 'Take on high-yield multiple choice questions with rich educational explanations.' 
                        }
                      ].map((game) => (
                        <div
                          key={game.id}
                          onClick={() => setGameType(game.id as any)}
                          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-40 ${
                            gameType === game.id
                              ? 'bg-violet-600/10 border-violet-500 ring-2 ring-violet-500/20'
                              : isLight ? 'bg-gray-50 hover:bg-gray-100 border-gray-200' : 'bg-white/2 border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <div>
                            <h4 className="text-xs font-extrabold tracking-tight mb-2">{game.title}</h4>
                            <p className="text-[10px] leading-relaxed opacity-60">{game.desc}</p>
                          </div>
                          <span className={`text-[9px] uppercase tracking-wider font-black ${gameType === game.id ? 'text-violet-500 dark:text-violet-400' : 'opacity-40'}`}>
                            {gameType === game.id ? 'Selected Mode' : 'Select'}
                          </span>
                        </div>
                      ))}

                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-sm rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-55 cursor-pointer shadow-lg shadow-violet-600/15 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{generationStep}</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Custom Socratic Game!</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* --- ACTIVE GAME PLAY --- */}
          {viewState === 'playing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl mx-auto space-y-6"
            >
              {/* Back & Stat Header */}
              <div className={`p-4 md:p-6 rounded-3xl border flex items-center justify-between gap-4 ${
                isLight ? 'bg-white border-gray-150 shadow-sm text-gray-950' : 'bg-white/5 border-white/10 text-white'
              }`}>
                <div>
                  <button 
                    onClick={handleExitGame}
                    className="text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400 flex items-center gap-1.5 hover:underline"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Back to Games Dashboard</span>
                  </button>
                  <h3 className="text-lg font-black font-serif italic truncate mt-1 max-w-[280px] sm:max-w-md block">
                    {gameTitle}
                  </h3>
                </div>

                {/* Score and Dynamic Timer Display */}
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <span className="block text-[8px] uppercase tracking-widest opacity-50">Score Tracker</span>
                    <span className="text-base font-black font-mono text-emerald-400">
                      {gameType === 'spell_check' && spellScore}
                      {gameType === 'scramble' && scrambleScore}
                      {gameType === 'trivia' && triviaScore}
                      {gameType === 'crossword' && (crosswordSolved ? crosswordWords.length : "In-Progress")}
                    </span>
                  </div>
                  
                  {timerDuration > 0 && !spellSubmitted && !scrambleSubmitted && !triviaSubmitted && (
                    <div className={`flex items-center gap-2 pl-4 border-l ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
                      <Clock className="w-4 h-4 text-sky-400 animate-pulse" />
                      <span className="text-lg font-mono font-black text-sky-400">{timeLeft}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- GAME-SPECIFIC PLAY SCREENS --- */}

              {/* 1. Spell Check Game UI */}
              {gameType === 'spell_check' && spellChallenges.length > 0 && (
                <div className={`p-6 md:p-10 rounded-[2.5rem] border ${
                  isLight ? 'bg-white border-gray-150 text-gray-950 shadow-sm' : 'bg-white/5 border-white/10 text-white'
                }`}>
                  <div className="flex items-center justify-between border-b pb-4 mb-6 opacity-60">
                    <span className="text-xs uppercase tracking-widest font-black">Spelling Challenge {spellCurrentIdx + 1} of {spellChallenges.length}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => !spellSubmitted && setSpellActiveSubMode('mcq')}
                        disabled={spellSubmitted}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border transition-all ${
                          spellActiveSubMode === 'mcq' 
                            ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        Option Click
                      </button>
                      <button
                        onClick={() => !spellSubmitted && setSpellActiveSubMode('fill')}
                        disabled={spellSubmitted}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border transition-all ${
                          spellActiveSubMode === 'fill' 
                            ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        Write Spelling
                      </button>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-1">Clue & Definition</h4>
                    <p className="text-lg font-bold font-serif leading-relaxed italic">
                      "{spellChallenges[spellCurrentIdx].definition}"
                    </p>
                  </div>

                  {spellActiveSubMode === 'mcq' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {spellChallenges[spellCurrentIdx].options.map((option, idx) => {
                        const isCorrect = idx === spellChallenges[spellCurrentIdx].correctAnswerIdx;
                        const isSelected = spellSelectedIdx === idx;
                        let btnStyle = isLight ? 'bg-gray-50 border-gray-200' : 'bg-black/20 border-white/5';
                        
                        if (spellSubmitted) {
                          if (isCorrect) btnStyle = 'bg-green-500/10 border-green-500 text-green-400';
                          else if (isSelected) btnStyle = 'bg-rose-500/10 border-rose-500 text-rose-400';
                          else btnStyle = 'opacity-30';
                        } else if (isSelected) {
                          btnStyle = 'border-violet-500 bg-violet-600/10';
                        }

                        return (
                          <button
                            key={idx}
                            disabled={spellSubmitted}
                            onClick={() => handleSelectSpellAnswer(idx)}
                            className={`p-4 rounded-xl border text-left font-bold text-sm transition-all flex items-center justify-between ${btnStyle}`}
                          >
                            <span>{option}</span>
                            {spellSubmitted && isCorrect && <Check className="w-4 h-4 text-green-500" />}
                            {spellSubmitted && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-500" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase font-black tracking-widest opacity-50">Fill-In-The-Blanks: <span className="font-mono text-xs">{spellChallenges[spellCurrentIdx].missingPattern}</span></label>
                        <input
                          type="text"
                          value={spellTypeAttempt}
                          onChange={(e) => setSpellTypeAttempt(e.target.value)}
                          placeholder="Type full correct spelling here"
                          disabled={spellSubmitted}
                          className={`px-4 py-3 border rounded-xl outline-none focus:border-violet-500 ${
                            isLight ? 'bg-gray-50 border-gray-200' : 'bg-black/30 border-white/10'
                          }`}
                        />
                      </div>
                      
                      {!spellSubmitted && (
                        <button
                          onClick={handleSubmitSpellFill}
                          className="px-6 py-2.5 bg-violet-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all"
                        >
                          Submit Word
                        </button>
                      )}
                    </div>
                  )}

                  {spellSubmitted && (
                    <div className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Socratic Answer Match</span>
                        <p className="text-sm font-bold mt-1">Correct Spelling is: <span className="text-green-400 font-mono underline">{spellChallenges[spellCurrentIdx].word}</span></p>
                      </div>
                      <button
                        onClick={handleNextSpell}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-transform"
                      >
                        {spellCurrentIdx + 1 === spellChallenges.length ? 'Results' : 'Next Spelling'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Crossword Jam UI */}
              {gameType === 'crossword' && crosswordWords.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Interactive 8x8 Crossword Board */}
                  <div className={`lg:col-span-7 p-6 md:p-8 rounded-[2.5rem] border flex flex-col items-center ${
                    isLight ? 'bg-white border-gray-150 shadow-sm text-gray-950' : 'bg-white/5 border-white/10 text-white'
                  }`}>
                    <h4 className="text-xs uppercase tracking-widest font-black mb-6 opacity-60">Interactive Puzzle Board</h4>
                    
                    <div className="grid grid-cols-8 gap-1.5 w-full aspect-square max-w-[360px]">
                      {Array(8).fill(null).map((_, r) => (
                        Array(8).fill(null).map((_, c) => {
                          const playable = isPlayableCell(r, c);
                          const cellNum = gridNumbers[`${r},${c}`];
                          const correct = isCellCorrect(r, c);
                          
                          let cellStyle = 'bg-black/60 border-transparent';
                          if (playable) {
                            cellStyle = isLight 
                              ? 'bg-gray-50 border-gray-200 text-gray-950 focus-within:border-violet-500' 
                              : 'bg-white/5 border-white/10 text-white focus-within:border-violet-500';
                            
                            // Highlight correct values in check mode
                            if (crosswordChecked) {
                              cellStyle = correct 
                                ? 'bg-green-500/10 border-green-500 text-green-400' 
                                : 'bg-rose-500/10 border-rose-500 text-rose-400 animate-pulse';
                            }
                          }

                          return (
                            <div 
                              key={`${r}-${c}`} 
                              className={`relative rounded-lg border flex items-center justify-center transition-all aspect-square ${cellStyle}`}
                            >
                              {playable ? (
                                <>
                                  {cellNum && (
                                    <span className="absolute top-1 left-1 text-[7px] md:text-[8px] leading-none font-bold opacity-70">
                                      {cellNum}
                                    </span>
                                  )}
                                  <input
                                    id={`cell-${r}-${c}`}
                                    type="text"
                                    maxLength={1}
                                    value={userGrid[r][c]}
                                    onChange={(e) => handleCellChange(r, c, e.target.value)}
                                    className="w-full h-full text-center bg-transparent border-none outline-none font-extrabold text-sm md:text-base capitalize p-0"
                                  />
                                </>
                              ) : null}
                            </div>
                          );
                        })
                      ))}
                    </div>

                    <div className="flex gap-4 mt-6 w-full max-w-[360px]">
                      <button
                        onClick={handleCheckCrossword}
                        className="flex-1 py-3 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all shadow-md shadow-violet-600/15"
                      >
                        Check Grid
                      </button>
                      <button
                        onClick={handleRevealSolveCrossword}
                        className={`py-3 px-4 border text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                          isLight ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        Reveal Solution
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Clues List */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className={`p-6 rounded-[2rem] border ${
                      isLight ? 'bg-white border-gray-150' : 'bg-white/5 border-white/10'
                    }`}>
                      <h4 className="text-xs uppercase tracking-widest font-black mb-4 border-b pb-2 opacity-70 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-violet-400" />
                        <span>Puzzle Clues</span>
                      </h4>

                      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                        {crosswordWords.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedWordIdx(idx)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                              selectedWordIdx === idx
                                ? 'bg-violet-600/10 border-violet-500'
                                : isLight ? 'bg-gray-50 hover:bg-gray-100 border-transparent' : 'bg-white/2 border-transparent hover:bg-white/5'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-violet-400">
                                CLUE {wordNumbers[idx] || idx + 1} ({item.direction})
                              </span>
                              <span className="text-[10px] font-mono opacity-50 font-semibold uppercase">{item.word.length} letters</span>
                            </div>
                            <p className="text-xs font-bold leading-relaxed">{item.clue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* 3. Word Scramble Game UI */}
              {gameType === 'scramble' && scrambleChallenges.length > 0 && (
                <div className={`p-6 md:p-10 rounded-[2.5rem] border ${
                  isLight ? 'bg-white border-gray-150 text-gray-950 shadow-sm' : 'bg-white/5 border-white/10 text-white'
                }`}>
                  <div className="border-b pb-4 mb-6 opacity-60 flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest font-black">Vocabulary Scramble {scrambleCurrentIdx + 1} of {scrambleChallenges.length}</span>
                    <span className="text-[10px] uppercase font-bold text-violet-400 font-mono">Unscramble the letters</span>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-1">Definition Clue</h4>
                    <p className="text-lg font-bold font-serif leading-relaxed italic">
                      "{scrambleChallenges[scrambleCurrentIdx].clue}"
                    </p>
                  </div>

                  {/* Scramble attempt field letter slots */}
                  <div className="flex flex-wrap gap-2 mb-8 justify-center min-h-[50px] p-4 bg-black/10 rounded-2xl border border-white/5">
                    {scrambleAttempt.length === 0 && (
                      <span className="text-xs font-semibold opacity-40 self-center uppercase tracking-widest">Tap letter bubbles below to spell the word</span>
                    )}
                    {scrambleAttempt.map((letter, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleScrambleAttemptLetterClick(idx)}
                        disabled={scrambleSubmitted}
                        className="w-10 h-10 rounded-lg bg-violet-600 border border-violet-500 text-white font-extrabold text-lg flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Pool of letter bubbles */}
                  <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {scramblePool.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleScramblePoolLetterClick(idx)}
                        disabled={item.used || scrambleSubmitted}
                        className={`w-12 h-12 rounded-full font-black text-lg flex items-center justify-center transition-all ${
                          item.used 
                            ? 'opacity-20 border-transparent cursor-not-allowed scale-90' 
                            : isLight 
                              ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900 cursor-pointer shadow-sm hover:scale-110'
                              : 'bg-white/5 border-white/10 text-white cursor-pointer hover:bg-white/12 hover:scale-110'
                        }`}
                      >
                        {item.letter}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={handleClearScramble}
                      disabled={scrambleSubmitted || scrambleAttempt.length === 0}
                      className="px-4 py-2 border border-white/10 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Word</span>
                    </button>

                    {!scrambleSubmitted ? (
                      <button
                        onClick={handleSubmitScramble}
                        disabled={scrambleAttempt.length === 0}
                        className="px-6 py-3 bg-violet-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all disabled:opacity-40"
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        onClick={handleNextScramble}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-transform"
                      >
                        {scrambleCurrentIdx + 1 === scrambleChallenges.length ? 'See Results' : 'Next Word'}
                      </button>
                    )}
                  </div>

                  {scrambleSubmitted && (
                    <div className="mt-8 pt-6 border-t border-white/5 bg-violet-600/[0.02] p-6 rounded-2xl border border-violet-500/10">
                      <div className="flex items-center gap-2 text-violet-400 font-bold uppercase tracking-widest text-[10px] mb-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <span>Socratic Solution Discovery</span>
                      </div>
                      <p className="text-sm font-black mb-2">Correct Word is: <span className="text-green-400 font-mono underline">{scrambleChallenges[scrambleCurrentIdx].word}</span></p>
                      <p className="text-xs leading-relaxed text-white/70">
                        {scrambleChallenges[scrambleCurrentIdx].explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Trivia Quiz Game UI */}
              {gameType === 'trivia' && triviaQuestions.length > 0 && (
                <div className={`p-6 md:p-10 rounded-[2.5rem] border ${
                  isLight ? 'bg-white border-gray-150 text-gray-950 shadow-sm' : 'bg-white/5 border-white/10 text-white'
                }`}>
                  <div className="border-b pb-4 mb-6 opacity-60">
                    <span className="text-xs uppercase tracking-widest font-black">Socratic Question {triviaCurrentIdx + 1} of {triviaQuestions.length}</span>
                  </div>

                  <h2 className="text-lg md:text-xl font-bold leading-relaxed mb-6 font-serif">
                    {triviaQuestions[triviaCurrentIdx].question}
                  </h2>

                  <div className="grid grid-cols-1 gap-3.5 mb-6">
                    {triviaQuestions[triviaCurrentIdx].options.map((option, idx) => {
                      const isCorrect = idx === triviaQuestions[triviaCurrentIdx].correctAnswerIdx;
                      const isSelected = triviaSelectedIdx === idx;
                      let optionStyles = isLight 
                        ? 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100' 
                        : 'bg-white/2 border-white/5 text-white hover:bg-white/5';

                      if (triviaSubmitted) {
                        if (isCorrect) optionStyles = 'bg-green-500/10 border-green-500 text-green-400 font-bold';
                        else if (isSelected) optionStyles = 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold';
                        else optionStyles = 'opacity-30 border-transparent';
                      } else if (isSelected) {
                        optionStyles = 'border-violet-500 bg-violet-600/10';
                      }

                      return (
                        <button
                          key={idx}
                          disabled={triviaSubmitted}
                          onClick={() => handleSelectTriviaAnswer(idx)}
                          className={`p-4 rounded-xl border text-left text-sm transition-all flex items-center justify-between cursor-pointer ${optionStyles}`}
                        >
                          <span>{option}</span>
                          {triviaSubmitted && isCorrect && <Check className="w-4 h-4 text-green-500" />}
                          {triviaSubmitted && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-500" />}
                        </button>
                      );
                    })}
                  </div>

                  {triviaSubmitted && (
                    <div className="mt-8 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex-1 bg-violet-600/[0.02] p-5 border border-violet-500/10 rounded-2xl">
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 block mb-1">Conceptual Breakdown</span>
                        <p className="text-xs leading-relaxed text-white/80">
                          {triviaQuestions[triviaCurrentIdx].explanation}
                        </p>
                      </div>
                      <button
                        onClick={handleNextTrivia}
                        className="px-6 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-transform self-end"
                      >
                        {triviaCurrentIdx + 1 === triviaQuestions.length ? 'Results Card' : 'Next Concept'}
                      </button>
                    </div>
                  )}
                </div>
              )}

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
              <div className={`p-8 md:p-10 rounded-[2.5rem] border text-center ${
                isLight ? 'bg-white border-gray-150 text-gray-950 shadow-sm' : 'bg-white/5 border-white/10 text-white'
              }`}>
                
                <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 text-white rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10">
                  <Trophy className="w-8 h-8 animate-bounce" />
                </div>

                <h2 className="text-3xl font-black font-serif italic mb-2">Subject Mastery Synced!</h2>
                <p className={`text-xs mb-6 max-w-md mx-auto ${isLight ? 'text-gray-600' : 'text-white/40'}`}>
                  You have successfully completed the custom academic game. Let's look at your educational feedback!
                </p>

                {/* Performance stats */}
                <div className={`grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8 p-4 rounded-2xl border ${
                  isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/2 border-white/5'
                }`}>
                  <div className="text-center">
                    <span className="block text-[8px] uppercase tracking-widest opacity-50 mb-1">Game Mode</span>
                    <span className="text-sm font-black capitalize">{gameType.replace('_', ' ')}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[8px] uppercase tracking-widest opacity-50 mb-1">Grade Level</span>
                    <span className="text-sm font-black text-violet-400 font-mono">{gradeClass}</span>
                  </div>
                </div>

                {/* Log list of questions answered */}
                <div className="text-left mb-8 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest opacity-60 px-1">Concept-by-Concept Log</h4>
                  
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {reviewLogs.map((log, idx) => (
                      <div 
                        key={idx}
                        className={`p-4 rounded-2xl border ${
                          log.isCorrect 
                            ? 'bg-green-500/5 border-green-500/20' 
                            : 'bg-rose-500/5 border-rose-500/20'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <h5 className="text-xs font-bold leading-relaxed pr-2">
                            {log.title}
                          </h5>
                          <span className={`text-[9px] uppercase font-mono tracking-wider font-extrabold flex-shrink-0 ${
                            log.isCorrect ? 'text-green-400' : 'text-rose-400'
                          }`}>
                            {log.isCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-white/50 mb-2">
                          <strong>Clue/Breakdown:</strong> {log.description}
                        </p>
                        <div className="text-[10px] font-mono flex flex-col gap-1 border-t border-white/5 pt-2 opacity-80">
                          <div><span className="opacity-50">Correct Answer:</span> <span className="text-green-400 font-bold">{log.correctAnswer}</span></div>
                          {!log.isCorrect && <div><span className="opacity-50">Your Answer:</span> <span className="text-rose-400 font-bold">{log.userAnswer}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setViewState('dashboard')}
                  className="px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold tracking-widest uppercase shadow-md shadow-violet-600/15"
                >
                  Generate Another Game
                </button>

              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
