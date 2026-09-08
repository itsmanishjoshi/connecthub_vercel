export interface TranscriptDraft {
  id: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  language?: string;
  text: string;
  confidence?: number;
  isFinal: boolean;
}

export interface SpeechToTextSession {
  start(): Promise<void>;
  stop(): void;
}

export interface SpeechToTextProvider {
  isSupported(): boolean;
  startSession(options: {
    onPartial: (draft: TranscriptDraft) => void;
    onFinal: (draft: TranscriptDraft) => void;
    onLanguage?: (language: string) => void;
    onError?: (message: string) => void;
  }): Promise<SpeechToTextSession>;
}
