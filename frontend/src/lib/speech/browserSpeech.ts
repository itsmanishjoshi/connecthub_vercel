import type { SpeechToTextProvider, TranscriptDraft } from './types';
import { correctBusinessTerms, pickRichestTranscript } from './termCorrector';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export const browserSpeechProvider: SpeechToTextProvider = {
  isSupported() {
    return Boolean(recognitionCtor());
  },
  async startSession({ onPartial, onFinal, onLanguage, onError }) {
    const Ctor = recognitionCtor();
    if (!Ctor) throw new Error('This browser does not support live speech recognition');
    const recognition = new Ctor();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    let stopped = false;
    let startedAt = Date.now();

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternatives = Array.from({ length: result.length || 1 }, (_, alt) => String(result[alt]?.transcript || '').trim());
        const text = correctBusinessTerms(pickRichestTranscript(alternatives));
        if (!text) continue;
        const language = result[0]?.language || recognition.lang || undefined;
        if (language) onLanguage?.(language);
        const draft: TranscriptDraft = {
          id: `live-${index}-${Math.round(result[0]?.startTime || Date.now())}`,
          speakerLabel: 'Speaker',
          startMs: Math.max(0, Math.round(((result[0]?.startTime || 0) * 1000) || Date.now() - startedAt)),
          endMs: Math.max(0, Math.round(((result[0]?.endTime || 0) * 1000) || Date.now() - startedAt)),
          language,
          text,
          confidence: typeof result[0]?.confidence === 'number' ? result[0].confidence : undefined,
          isFinal: Boolean(result.isFinal),
        };
        if (result.isFinal) onFinal(draft);
        else onPartial(draft);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      onError?.(event.error === 'not-allowed'
        ? 'Microphone permission was denied'
        : 'Live transcription was interrupted');
    };
    recognition.onend = () => {
      if (!stopped) {
        try { recognition.start(); } catch { /* keep session alive */ }
      }
    };
    recognition.start();
    startedAt = Date.now();
    return {
      async start() {},
      stop() {
        stopped = true;
        try { recognition.stop(); } catch { /* already stopped */ }
      },
    };
  },
};
