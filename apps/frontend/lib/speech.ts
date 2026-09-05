/**
 * Typed surface for the browser Web Speech API — speech recognition
 * (`SpeechRecognition` / `webkitSpeechRecognition`) and text-to-speech
 * (`speechSynthesis`). Everything here runs fully client-side; nothing is
 * sent to our backend.
 *
 * The recognition types are not part of lib.dom (yet), so they're declared
 * here and narrowed to the bits we actually use.
 */

/* ------------------------------------------------------------------ */
/* Recognition                                                         */
/* ------------------------------------------------------------------ */

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

export interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const ctor =
  typeof window !== "undefined"
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : undefined;

/** True when the current browser exposes a speech-recognition implementation. */
export const speechRecognitionSupported = typeof ctor === "function";

export function createSpeechRecognizer(): SpeechRecognition {
  if (!ctor) throw new Error("Speech recognition is not supported in this browser");
  return new ctor();
}

/* ------------------------------------------------------------------ */
/* Speech synthesis (text-to-speech)                                   */
/* ------------------------------------------------------------------ */

export const speechSynthesisSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

/** Coarse markdown-to-plain-text so TTS reads prose, not `#` and pipes. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " Code block. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#]/g, "")
    .replace(/[-]{3,}/g, ".")
    .replace(/\|/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads `text` aloud with the OS (browser) voice. Markdown is stripped so
 * only the actual message is spoken. Safe no-op when synthesis unsupported.
 */
export function speak(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void }
): void {
  if (!speechSynthesisSupported) {
    opts?.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
  utterance.rate = 1.05;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = synth.getVoices();
  const preferred = voices.find((v) => {
    const name = v.name.toLowerCase();
    return v.lang.startsWith("en") && /female|natural|samantha|google us english/.test(name);
  });
  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => opts?.onStart?.();
  utterance.onend = () => opts?.onEnd?.();
  utterance.onerror = () => opts?.onEnd?.();

  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSynthesisSupported) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return speechSynthesisSupported && window.speechSynthesis.speaking;
}