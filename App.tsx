import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Play, Pause, Mic, Book, RotateCcw, ChevronRight, ChevronLeft, 
  Volume2, Info, X, Search, CheckCircle, AlertCircle, Loader2, Sparkles, 
  Send, HelpCircle, FileText, Check, ScrollText, 
  BookType, Home, Layers, Heart, Baby, Copy, ListTodo, PenTool, 
  History, Menu, RefreshCw, Maximize2, Minimize2, Share2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Surah, Ayah, QuizQuestion, LastRead, TafseerResponse } from './types';

// --- API Configurations ---
const API_BASE = "https://api.alquran.cloud/v1";

// --- Helper Functions ---
const removeTashkeel = (text: string) => text.replace(/([^\u0621-\u063A\u0641-\u064A\u0660-\u0669a-zA-Z 0-9])/g, '');

export default function App() {
  // Navigation & View State
  const [view, setView] = useState<'landing' | 'app' | 'about'>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Quran Data State
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [surahContent, setSurahContent] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(null);
  
  // Last Read State
  const [lastRead, setLastRead] = useState<LastRead | null>(null);

  // Audio & Interaction State
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'read' | 'memorize'>('read');
  const [searchQuery, setSearchQuery] = useState("");
  
  // Overlays State
  const [tafseerData, setTafseerData] = useState<TafseerResponse | null>(null);
  const [showTafseer, setShowTafseer] = useState(false);
  
  // AI & Quiz State
  const [showAIModal, setShowAIModal] = useState(false);
  const [isAiModalExpanded, setIsAiModalExpanded] = useState(false);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTitle, setAiTitle] = useState("");
  const [aiMode, setAiMode] = useState<'text' | 'quiz'>('text'); 
  const [userQuestion, setUserQuestion] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Memorization State
  const [isListening, setIsListening] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'correct' | 'partial' | 'incorrect' | null>(null); 

  // Refs
  const audioRef = useRef(new Audio());
  const recognitionRef = useRef<any>(null);

  // --- Initial Fetch ---
  const fetchSurahList = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/surah`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSurahs(data.data);
      
      const saved = localStorage.getItem('quran_last_read');
      if (saved) setLastRead(JSON.parse(saved));
    } catch (err) {
      console.error("Error fetching surahs:", err);
      setFetchError("عذراً، تعذر جلب بيانات السور. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurahList();
  }, []);

  useEffect(() => {
    if (currentSurah) {
        const data: LastRead = { 
            surahNumber: currentSurah.number, 
            surahName: currentSurah.name,
            timestamp: Date.now() 
        };
        localStorage.setItem('quran_last_read', JSON.stringify(data));
        setLastRead(data);
    }
  }, [currentSurah]);

  const stopAudio = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
    }
  };

  const loadSurah = async (surahNumber: number) => {
    setContentLoading(true);
    setActiveAyah(null);
    setTafseerData(null);
    stopAudio();
    setIsSidebarOpen(false); 
    
    try {
      const res = await fetch(`${API_BASE}/surah/${surahNumber}/ar.mahermuaiqly`);
      if (!res.ok) throw new Error("Failed to load surah content");
      const data = await res.json();
      setCurrentSurah(data.data);
      setSurahContent(data.data.ayahs);
      setView('app');
    } catch (error) {
      console.error("Error loading surah:", error);
      alert("حدث خطأ أثناء تحميل السورة. يرجى المحاولة لاحقاً.");
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    const handleEnded = () => {
        const currentIndex = surahContent.findIndex(a => a.number === activeAyah?.number);
        if (currentIndex !== -1 && currentIndex < surahContent.length - 1) {
            setActiveAyah(surahContent[currentIndex + 1]);
        } else {
            setIsPlaying(false);
        }
    };
    audioRef.current.addEventListener('ended', handleEnded);
    return () => audioRef.current.removeEventListener('ended', handleEnded);
  }, [activeAyah, surahContent]);

  useEffect(() => {
    if (activeAyah && isPlaying) {
        if (audioRef.current.src !== activeAyah.audio) {
            audioRef.current.src = activeAyah.audio;
            audioRef.current.load();
        }
        audioRef.current.play().catch(() => setIsPlaying(false));
    } else if (!isPlaying) {
        audioRef.current.pause();
    }
  }, [activeAyah, isPlaying]);

  const togglePlay = (ayah: Ayah) => {
    if (activeAyah?.number === ayah.number && isPlaying) {
      setIsPlaying(false);
    } else {
      setActiveAyah(ayah);
      setIsPlaying(true);
    }
  };

  const fetchTafseer = async (surahNum: number, ayahNum: number) => {
    setTafseerData(null);
    setShowTafseer(true);
    try {
      const res = await fetch(`${API_BASE}/ayah/${surahNum}:${ayahNum}/ar.muyassar`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTafseerData({ text: data.data.text });
    } catch (err) {
      setTafseerData({ text: "عذراً، حدث خطأ أثناء جلب التفسير." });
    }
  };

  const callGemini = async (prompt: string, isJson: boolean = false) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setAiContent("خطأ: لم يتم العثور على مفتاح API_KEY في إعدادات البيئة (Vercel). يرجى مراجعة دليل README.");
      setAiLoading(false);
      return null;
    }

    setAiLoading(true);
    if (!isJson) setAiContent(null);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const config: any = {};
      if (isJson) config.responseMimeType = "application/json";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: config
      });
      
      const text = response.text;
      if (!text) throw new Error("No response text");

      if (isJson) {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
      }
      setAiContent(text);
    } catch (error) {
        console.error(error);
      if (!isJson) setAiContent("عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. تأكد من صحة مفتاح الـ API وصلاحيته.");
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIAction = (type: string, ayah?: Ayah) => {
    const targetAyah = ayah || activeAyah;
    if (!targetAyah || !currentSurah) return;

    setActiveAyah(targetAyah);
    setShowAIModal(true);
    setAiMode('text');
    setIsAiModalExpanded(false);
    
    let title = "";
    let prompt = "";
    const context = `الآية: "${targetAyah.text}" (سورة ${currentSurah.name})`;

    switch(type) {
      case 'tadabbur':
        title = "تدبر ومساعد قرآني";
        prompt = `بصفتك مساعداً للتدبر، اشرح الآية شرحاً مبسطاً مع 3 نقاط عملية للتدبر: ${context}`;
        break;
      case 'tajweed':
        title = "أحكام التجويد";
        prompt = `استخرج أحكام التجويد من هذه الآية بشكل قائمة واضحة: ${context}`;
        break;
      case 'vocab':
        title = "غريب القرآن والمفردات";
        prompt = `اشرح المفردات الصعبة (غريب القرآن) في هذه الآية: ${context}`;
        break;
      case 'dua':
        title = "دعاء مستوحى";
        prompt = `صغ دعاءً خاشعاً مستوحى من معاني هذه الآية: ${context}`;
        break;
      case 'kids':
        title = "المفسر الصغير";
        prompt = `اشرح هذه الآية لطفل عمره 7 سنوات بأسلوب قصصي يبدأ بـ "يا بطل": ${context}`;
        break;
      case 'mutashabihat':
        title = "المتشابهات اللفظية";
        prompt = `استخرج الآيات المتشابهة لفظياً مع هذه الآية لضبط الحفظ: ${context}`;
        break;
      case 'action':
        title = "العمل بالآية";
        prompt = `اقترح 3 خطوات عملية تطبيقية يمكن تنفيذها اليوم بناءً على هذه الآية: ${context}`;
        break;
      case 'irab':
        title = "الإعراب النحوي";
        prompt = `أعرب هذه الآية إعرباً ميسراً يوضح مواقع الكلمات الرئيسية: ${context}`;
        break;
      case 'asbab':
        title = "أسباب النزول";
        prompt = `ما سبب نزول هذه الآية أو سياقها التاريخي؟ ${context}`;
        break;
      case 'summary':
        title = `ملخص سورة ${currentSurah.name}`;
        prompt = `لخص سورة ${currentSurah.name} (محاورها، سبب التسمية، والدروس) في نقاط.`;
        break;
      case 'quiz':
        setAiMode('quiz');
        title = `اختبار: سورة ${currentSurah.name}`;
        setQuizQuestions([]);
        setQuizScore(0);
        setCurrentQuizIndex(0);
        setQuizFinished(false);
        prompt = `أنشئ اختباراً من 3 أسئلة اختيار من متعدد عن سورة ${currentSurah.name} بتنسيق JSON: [{"question": "", "options": [], "correctIndex": 0}]`;
        callGemini(prompt, true).then(q => q && setQuizQuestions(q));
        return; 
      default: return;
    }
    setAiTitle(title);
    callGemini(prompt);
  };

  const copyAyah = (ayah: Ayah) => {
    const textToCopy = `${ayah.text} [سورة ${currentSurah?.name}: ${ayah.numberInSurah}]`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopyStatus(ayah.number.toString());
        setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const handleAskQuestion = () => {
    if (!userQuestion.trim() || !activeAyah || !currentSurah) return;
    const context = `الآية: "${activeAyah.text}" (سورة ${currentSurah.name})`;
    const prompt = `بصفتك عالماً ومساعداً قرآنياً، أجب عن السؤال التالي المتعلق بالآية: ${context} \n\nالسؤال: ${userQuestion}`;
    callGemini(prompt);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    
    if (!('webkitSpeechRecognition' in window)) {
      alert("يرجى استخدام متصفح Chrome لتفعيل ميزة التسميع.");
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    
    recognition.onstart = () => {
        setIsListening(true);
        setMatchStatus(null);
    };
    recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        verifyRecitation(transcript);
    };
    recognition.onend = () => setIsListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const verifyRecitation = (transcript: string) => {
    if (!activeAyah) return;
    const cleanAyah = removeTashkeel(activeAyah.text);
    const cleanSpoken = removeTashkeel(transcript);
    
    if (cleanAyah.includes(cleanSpoken) || cleanSpoken.includes(cleanAyah)) {
      setMatchStatus('correct');
    } else {
      const w1 = cleanAyah.split(' ');
      const w2 = cleanSpoken.split(' ');
      const matchCount = w1.filter(w => w2.includes(w)).length;
      if (matchCount / w1.length > 0.6) setMatchStatus('correct');
      else if (matchCount / w1.length > 0.3) setMatchStatus('partial');
      else setMatchStatus('incorrect');
    }
  };

  const activeMeta = activeAyah ? {
      juz: activeAyah.juz,
      hizb: Math.ceil(activeAyah.hizbQuarter / 4),
      page: activeAyah.page
  } : null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-stone-50 text-emerald-800">
      <Loader2 className="w-12 h-12 animate-spin mb-4" />
      <p className="text-xl font-amiri animate-pulse">مصحف الإيمان</p>
    </div>
  );

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center h-screen bg-stone-50 text-stone-800 p-8 text-center" dir="rtl">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold font-amiri mb-2 text-stone-900">خطأ في الاتصال</h2>
      <p className="text-stone-500 max-w-sm mb-8 leading-relaxed font-sans">{fetchError}</p>
      <button 
        onClick={fetchSurahList}
        className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 active:scale-95"
      >
        <RefreshCw className="w-5 h-5" /> إعادة المحاولة
      </button>
    </div>
  );

  if (view === 'landing') return (
    <div className="flex flex-col min-h-screen bg-stone-50 text-stone-800 font-amiri relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none"></div>
        
        <header className="p-6 flex justify-between items-center z-10">
            <div className="flex items-center gap-2 text-emerald-800">
                <BookOpen className="w-8 h-8" />
                <span className="text-2xl font-bold">مصحف الإيمان</span>
            </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center z-10 mt-[-50px]">
            <div className="w-24 h-24 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-3xl rotate-3 flex items-center justify-center shadow-2xl mb-8 animate-in fade-in zoom-in duration-1000">
                <BookOpen className="w-12 h-12 text-white -rotate-3" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-stone-900 mb-6 leading-tight">
                رفيقك <span className="text-emerald-600">القرآني</span> <br/> الذكي
            </h1>
            <p className="text-xl text-stone-500 max-w-2xl mb-10 leading-relaxed">
                تجربة تلاوة عصرية تجمع بين روحانية النص وتقنيات الذكاء الاصطناعي. تدبر، احفظ، وافهم القرآن كما لم تفعل من قبل.
            </p>
            
            <div className="flex flex-col w-full max-w-md gap-4">
                {lastRead ? (
                    <button 
                        onClick={() => loadSurah(lastRead.surahNumber)} 
                        className="w-full bg-emerald-800 hover:bg-emerald-900 text-white py-4 rounded-xl shadow-lg shadow-emerald-200 font-bold text-lg transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                    >
                        <span>متابعة من {lastRead.surahName}</span>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                ) : (
                    <button onClick={() => setView('app')} className="w-full bg-emerald-800 hover:bg-emerald-900 text-white py-4 rounded-xl shadow-lg shadow-emerald-200 font-bold text-lg transition-all transform hover:-translate-y-1">
                        ابـدأ الـقـراءة
                    </button>
                )}
                
                <div className="flex flex-row gap-4">
                    {lastRead && (
                        <button onClick={() => setView('app')} className="flex-1 bg-white border-2 border-stone-200 hover:border-emerald-500 text-stone-700 hover:text-emerald-700 py-4 rounded-xl font-bold text-lg transition-all">
                            فهرس السور
                        </button>
                    )}
                    <button onClick={() => { setView('app'); setMode('memorize'); }} className="flex-1 bg-white border-2 border-stone-200 hover:border-emerald-500 text-stone-700 hover:text-emerald-700 py-4 rounded-xl font-bold text-lg transition-all">
                        تسميع
                    </button>
                </div>
                
                <button 
                    onClick={() => setView('about')}
                    className="text-stone-400 hover:text-emerald-600 text-sm font-bold mt-4 flex items-center justify-center gap-1 transition-colors"
                >
                    <Info className="w-4 h-4" /> عن التطبيق
                </button>
            </div>
        </main>
        
        <footer className="p-6 text-center text-stone-400 text-sm font-sans z-10 flex flex-col gap-1">
            <p>© {new Date().getFullYear()} مصحف الإيمان - جميع الحقوق محفوظة</p>
            <p>تطوير محمد خالد</p>
        </footer>
    </div>
  );

  if (view === 'about') return (
    <div className="flex flex-col h-screen bg-stone-50 overflow-auto relative" dir="rtl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none"></div>
        <header className="bg-emerald-800 text-white p-4 shadow-lg sticky top-0 z-20">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                <button onClick={() => setView('landing')} className="hover:bg-emerald-700 p-2 rounded-full transition-colors">
                    <ChevronRight className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-amiri font-bold">عن مصحف الإيمان</h1>
            </div>
        </header>
        <div className="max-w-3xl mx-auto p-8 relative z-10">
            <div className="prose prose-lg font-amiri text-stone-700 mx-auto">
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-emerald-700" />
                    </div>
                </div>
                <h2 className="text-center text-3xl font-bold text-emerald-800 mb-6">مصحف الإيمان</h2>
                <p className="text-center text-lg leading-loose mb-12">
                    تطبيق قرآني متكامل يهدف لخدمة كتاب الله عز وجل باستخدام أحدث تقنيات الذكاء الاصطناعي، ليجمع بين أصالة النص وعبقرية التقنية.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { icon: Sparkles, title: "الذكاء الاصطناعي", desc: "تدبر الآيات واستخراج المعاني والملخصات والإعراب." },
                        { icon: Mic, title: "المسمع الآلي", desc: "اختبر حفظك من خلال القراءة وسيتحقق النظام تلقائياً." },
                        { icon: Book, title: "التفسير الميسر", desc: "الوصول السريع لتفسير الآيات وغريب القرآن." },
                        { icon: Volume2, title: "تلاوات عذبة", desc: "الاستماع للآيات بصوت الشيخ ماهر المعيقلي." },
                        { icon: Heart, title: "دعاء مستوحى", desc: "توليد أدعية خاشعة مستوحاة من معاني الآيات." },
                        { icon: Baby, title: "للأطفال", desc: "شرح مبسط وقصصي للآيات يناسب الأطفال." },
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
                            <feature.icon className="w-8 h-8 text-emerald-600 mb-3" />
                            <h3 className="font-bold text-lg text-stone-800 mb-2">{feature.title}</h3>
                            <p className="text-sm text-stone-500 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 p-8 bg-rose-50 rounded-2xl border border-rose-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Heart className="w-24 h-24 text-rose-500" />
                    </div>
                    <Heart className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-rose-800 mb-2">إهداء خاص</h3>
                    <p className="text-stone-600 text-lg">
                        إلى رفيقة الدرب وزينة الحياة.. إلى زوجتي العزيزة 
                        <span className="font-bold text-rose-700 block mt-2 text-2xl">إيمان</span>
                    </p>
                </div>

                <div className="mt-12 pt-8 border-t border-stone-200 text-center">
                    <p className="text-stone-500 font-sans text-sm font-bold">تطوير محمد خالد</p>
                </div>
            </div>
        </div>
    </div>
  );

  const filteredSurahs = surahs.filter(s => s.name.includes(searchQuery));

  return (
    <div dir="rtl" className="flex h-screen bg-stone-100 font-sans text-stone-900 overflow-hidden">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 right-0 w-80 bg-white border-l border-stone-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:shadow-none md:z-auto
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-xl font-bold font-amiri text-emerald-900">فهرس السور</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-stone-400 hover:bg-stone-100 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-4">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="ابحث عن سورة..." 
                        className="w-full pl-4 pr-10 py-3 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-stone-400" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-1">
                {filteredSurahs.map((surah) => (
                    <button
                        key={surah.number}
                        onClick={() => loadSurah(surah.number)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                            currentSurah?.number === surah.number 
                            ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-200' 
                            : 'hover:bg-stone-50 text-stone-600'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold font-number ${
                                currentSurah?.number === surah.number ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-100 text-stone-500'
                            }`}>
                                {surah.number}
                            </span>
                            <div className="text-right">
                                <p className="font-bold font-amiri text-lg leading-none">{surah.name}</p>
                                <p className="text-[10px] text-stone-400 mt-1">{surah.englishName}</p>
                            </div>
                        </div>
                        <div className="text-xs text-stone-400 font-number">{surah.numberOfAyahs} آية</div>
                    </button>
                ))}
            </div>
            
            <div className="p-4 border-t border-stone-100">
                <button onClick={() => setView('landing')} className="w-full flex items-center justify-center gap-2 text-stone-500 hover:text-emerald-700 py-2 rounded-lg hover:bg-stone-50 transition-colors text-sm font-bold">
                    <Home className="w-4 h-4" /> العودة للرئيسية
                </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#FDFCF8] relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 h-16 flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-stone-100 rounded-lg text-stone-600">
                    <Menu className="w-6 h-6" />
                </button>
                {currentSurah ? (
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold font-amiri text-emerald-900 leading-none">{currentSurah.name}</h1>
                        <span className="text-[10px] text-stone-500 mt-0.5 font-number">
                            {currentSurah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} • {currentSurah.numberOfAyahs} آية
                        </span>
                    </div>
                ) : (
                    <span className="text-stone-400 text-sm font-bold">اختر سورة للبدء</span>
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="flex bg-stone-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setMode('read')} 
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'read' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-500'}`}
                    >
                        قراءة
                    </button>
                    <button 
                        onClick={() => setMode('memorize')} 
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${mode === 'memorize' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-500'}`}
                    >
                        <Mic className="w-3 h-3" /> تسميع
                    </button>
                </div>
                
                {currentSurah && (
                    <>
                        <div className="w-px h-6 bg-stone-200 mx-1 hidden sm:block"></div>
                        <button onClick={() => handleAIAction('summary')} className="hidden sm:flex items-center gap-1 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg transition-colors">
                            <FileText className="w-3 h-3" /> ملخص
                        </button>
                        <button onClick={() => handleAIAction('quiz')} className="hidden sm:flex items-center gap-1 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg transition-colors">
                            <HelpCircle className="w-3 h-3" /> اختبار
                        </button>
                    </>
                )}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative animate-in fade-in duration-500">
            {!currentSurah ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8">
                    <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-amiri text-lg">اختر سورة من القائمة لتبدأ رحلتك</p>
                </div>
            ) : contentLoading ? (
                <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                </div>
            ) : (
                <div className="max-w-3xl mx-auto p-4 md:p-8 pb-32">
                    {currentSurah.number !== 1 && currentSurah.number !== 9 && (
                        <div className="text-center mb-12 mt-4 animate-in slide-in-from-top duration-700">
                            <p className="text-2xl md:text-3xl font-amiri text-emerald-900 select-none">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
                        </div>
                    )}

                    <div className="font-amiri text-justify leading-[2.8] md:leading-[3.5] text-2xl md:text-3xl text-stone-800" dir="rtl">
                        {surahContent.map((ayah) => (
                            <span key={ayah.number} className="inline relative group">
                                <span 
                                    onClick={() => { setActiveAyah(ayah); setIsPlaying(false); }}
                                    className={`
                                        px-1 rounded-lg cursor-pointer transition-all duration-300
                                        ${activeAyah?.number === ayah.number ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'hover:bg-stone-100'}
                                        ${mode === 'memorize' && activeAyah?.number === ayah.number ? 'blur-sm select-none' : ''}
                                    `}
                                >
                                    {ayah.text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim()}
                                </span>
                                <span className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 mx-1 align-middle select-none text-emerald-700 text-xs md:text-sm font-number bg-[url('https://upload.wikimedia.org/wikipedia/commons/6/68/Ayah_Sign.svg')] bg-contain bg-center bg-no-repeat">
                                    <span className="mt-1">{ayah.numberInSurah}</span>
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {activeAyah && activeMeta && (
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 animate-in slide-in-from-bottom duration-300">
                <div className="px-4 py-2 border-b border-stone-100 flex justify-between items-center text-[10px] text-stone-400 font-sans font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> جزء {activeMeta.juz} • حزب {activeMeta.hizb}</span>
                    <span>صفحة {activeMeta.page}</span>
                </div>

                <div className="p-3">
                    <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1 px-1 scroll-smooth">
                        <div className="flex items-center gap-2 shrink-0">
                            <button 
                                onClick={() => togglePlay(activeAyah)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:scale-105 transition-all"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                            </button>
                            <button 
                                onClick={() => currentSurah && fetchTafseer(currentSurah.number, activeAyah.numberInSurah)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                                title="تفسير"
                            >
                                <Book className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => copyAyah(activeAyah)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                                title="نسخ الآية"
                            >
                                {copyStatus === activeAyah.number.toString() ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="w-px h-8 bg-stone-200 shrink-0 mx-1"></div>

                        <div className="flex items-center gap-2 shrink-0">
                            {[
                                { id: 'tadabbur', label: 'تدبر', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
                                { id: 'tajweed', label: 'تجويد', icon: ScrollText, color: 'text-teal-600 bg-teal-50' },
                                { id: 'vocab', label: 'مفردات', icon: BookType, color: 'text-indigo-600 bg-indigo-50' },
                                { id: 'dua', label: 'دعاء', icon: Heart, color: 'text-rose-600 bg-rose-50' },
                                { id: 'action', label: 'عمل', icon: ListTodo, color: 'text-green-600 bg-green-50' },
                                { id: 'irab', label: 'إعراب', icon: PenTool, color: 'text-fuchsia-600 bg-fuchsia-50' },
                                { id: 'asbab', label: 'أسباب النزول', icon: History, color: 'text-slate-600 bg-slate-50' },
                                { id: 'mutashabihat', label: 'متشابهات', icon: Copy, color: 'text-cyan-600 bg-cyan-50' },
                                { id: 'kids', label: 'للأطفال', icon: Baby, color: 'text-orange-600 bg-orange-50' },
                            ].map((tool) => (
                                <button
                                    key={tool.id}
                                    onClick={() => handleAIAction(tool.id, activeAyah)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 border border-transparent hover:border-stone-200 ${tool.color}`}
                                >
                                    <tool.icon className="w-3.5 h-3.5" />
                                    {tool.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {mode === 'memorize' && activeAyah && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-stone-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl z-20 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                {isListening ? (
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-sm font-bold">جاري الاستماع...</span>
                    </div>
                ) : (
                    <span className="text-sm font-bold flex items-center gap-2">
                        {matchStatus === 'correct' ? <><CheckCircle className="text-green-400 w-5 h-5"/> ممتاز!</> : 
                         matchStatus === 'partial' ? <><AlertCircle className="text-amber-400 w-5 h-5"/> جيد، حاول مجدداً</> :
                         matchStatus === 'incorrect' ? <><X className="text-red-400 w-5 h-5"/> خطأ، حاول مجدداً</> :
                         "اضغط الميكروفون للتسميع"}
                    </span>
                )}
                <button 
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
                >
                    <Mic className="w-5 h-5" />
                </button>
            </div>
        )}
      </main>

      {showTafseer && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-0 md:p-4" onClick={() => setShowTafseer(false)}>
            <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-emerald-50/50 rounded-t-2xl shrink-0">
                    <h3 className="font-bold font-amiri text-emerald-900 text-lg">التفسير الميسر</h3>
                    <button onClick={() => setShowTafseer(false)} className="p-1 hover:bg-stone-100 rounded-full"><X className="w-5 h-5 text-stone-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto font-amiri text-lg text-stone-700 leading-relaxed custom-scrollbar overscroll-contain">
                    {tafseerData ? tafseerData.text : <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-500"/></div>}
                </div>
            </div>
        </div>
      )}

      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className={`
              bg-white w-full shadow-2xl border-stone-100 overflow-hidden flex flex-col transition-all duration-300 ease-in-out animate-in zoom-in
              ${isAiModalExpanded ? 'sm:max-w-[95vw] sm:h-[95vh] h-full rounded-none' : 'sm:max-w-2xl sm:max-h-[90vh] h-full sm:h-auto sm:rounded-3xl rounded-none'}
            `}>
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-stone-50 to-white border-b border-stone-100 p-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 max-w-[70%]">
                        <div className={`p-2 rounded-xl shrink-0 ${aiMode === 'quiz' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                            {aiMode === 'quiz' ? <HelpCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <h3 className="font-bold font-amiri text-lg sm:text-xl text-stone-800 line-clamp-1">{aiTitle}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setIsAiModalExpanded(!isAiModalExpanded)} 
                            className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-emerald-600 transition-colors hidden sm:block"
                            title={isAiModalExpanded ? "تصغير" : "توسيع"}
                        >
                            {isAiModalExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => setShowAIModal(false)} 
                          className="p-3 sm:p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-red-500 transition-colors"
                          aria-label="إغلاق"
                        >
                            <X className="w-6 h-6 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#FAFAF9] custom-scrollbar overscroll-contain">
                    {aiLoading && !aiContent && quizQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-stone-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-600" />
                            <p className="font-amiri text-lg animate-pulse">جاري المعالجة الذكية...</p>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto w-full">
                            {aiMode === 'text' && (
                                <div className="prose prose-lg max-w-none font-amiri text-stone-800">
                                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 mb-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-lg sm:text-2xl text-center leading-loose text-emerald-950 font-amiri flex-1">
                                                {activeAyah?.text}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="whitespace-pre-wrap leading-relaxed text-lg sm:text-xl text-stone-700">
                                        {aiContent}
                                    </div>
                                </div>
                            )}

                            {aiMode === 'quiz' && quizQuestions.length > 0 && (
                                <div className="flex flex-col items-center justify-center min-h-full w-full py-4">
                                    {!quizFinished ? (
                                        <div className="w-full max-w-lg bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-stone-100 mx-auto">
                                            <div className="flex justify-between text-[10px] font-bold text-stone-400 mb-6 uppercase tracking-widest">
                                                <span>السؤال {currentQuizIndex + 1} / {quizQuestions.length}</span>
                                                <span>النقاط: {quizScore}</span>
                                            </div>
                                            <h3 className="text-lg sm:text-2xl font-bold text-stone-800 mb-8 font-amiri text-center leading-relaxed">
                                                {quizQuestions[currentQuizIndex].question}
                                            </h3>
                                            <div className="space-y-3">
                                                {quizQuestions[currentQuizIndex].options.map((option, idx) => {
                                                    let stateClass = "border-stone-200 hover:border-emerald-500 hover:bg-emerald-50";
                                                    if (isAnswerChecked) {
                                                        if (idx === quizQuestions[currentQuizIndex].correctIndex) stateClass = "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-100";
                                                        else if (idx === selectedOption) stateClass = "border-red-500 bg-red-50 text-red-700";
                                                        else stateClass = "border-stone-100 opacity-50";
                                                    }
                                                    return (
                                                        <button 
                                                            key={idx} 
                                                            onClick={() => {
                                                                if(isAnswerChecked) return;
                                                                setSelectedOption(idx);
                                                                setIsAnswerChecked(true);
                                                                if(idx === quizQuestions[currentQuizIndex].correctIndex) setQuizScore(prev => prev + 1);
                                                            }}
                                                            disabled={isAnswerChecked}
                                                            className={`w-full p-4 rounded-xl border-2 text-right transition-all font-amiri text-lg sm:text-xl active:scale-[0.98] ${stateClass}`}
                                                        >
                                                            {option}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {isAnswerChecked && (
                                                <button 
                                                    onClick={() => {
                                                        if(currentQuizIndex < quizQuestions.length - 1) {
                                                            setCurrentQuizIndex(p => p + 1);
                                                            setSelectedOption(null);
                                                            setIsAnswerChecked(false);
                                                        } else setQuizFinished(true);
                                                    }}
                                                    className="mt-8 w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all text-lg active:scale-95"
                                                >
                                                    {currentQuizIndex < quizQuestions.length - 1 ? "السؤال التالي" : "عرض النتيجة النهائية"}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center animate-in zoom-in py-12">
                                            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <Check className="w-12 h-12" />
                                            </div>
                                            <h3 className="text-3xl font-bold text-stone-800 mb-2 font-amiri">أحسنت صنعاً!</h3>
                                            <p className="text-stone-500 mb-4 font-amiri text-lg">لقد أتممت الاختبار بنجاح</p>
                                            <div className="text-7xl font-bold text-emerald-600 my-8 font-number">{quizScore} / {quizQuestions.length}</div>
                                            <button 
                                                onClick={() => setShowAIModal(false)} 
                                                className="bg-stone-900 text-white px-10 py-4 rounded-xl font-bold hover:bg-black transition-all shadow-xl active:scale-95"
                                            >
                                                العودة للمصحف
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer / Chat Input */}
                {aiMode === 'text' && (
                    <div className="p-4 bg-white border-t border-stone-100 shrink-0 pb-safe">
                        <div className="max-w-4xl mx-auto flex gap-2">
                            <button 
                                onClick={() => handleAIAction(aiTitle.includes('تدبر') ? 'tadabbur' : 'asbab', activeAyah)} 
                                className="p-3 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors shrink-0"
                                title="إعادة التوليد"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                            <div className="relative flex-1">
                                <input 
                                    type="text" 
                                    value={userQuestion}
                                    onChange={(e) => setUserQuestion(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                                    placeholder="اسأل المساعد الذكي عن الآية..."
                                    className="w-full pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-sans text-sm md:text-base"
                                />
                                <button 
                                    onClick={handleAskQuestion}
                                    disabled={aiLoading || !userQuestion.trim()}
                                    className="absolute left-1.5 top-1.5 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-stone-300 transition-colors shadow-md active:scale-90"
                                >
                                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}
