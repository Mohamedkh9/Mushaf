export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  audio: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LastRead {
  surahNumber: number;
  surahName: string;
  timestamp: number;
}

export interface TafseerResponse {
  text: string;
}

// Global declaration for Speech Recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}