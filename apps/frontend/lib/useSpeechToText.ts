"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognizer,
  speechRecognitionSupported,
  stopSpeaking,
  type SpeechRecognition,
  type SpeechRecognitionErrorEvent,
} from "./speech";

export interface UseSpeechToTextOptions {
  /** Fired once with the final transcript after the user stops talking (or taps stop). */
  onFinal?: (text: string) => void;
}

export interface UseSpeechToTextResult {
  /** Whether this browser has a speech-recognition implementation. */
  supported: boolean;
  listening: boolean;
  /** Live transcript — interim words plus the finalized ones from this utterance. */
  transcript: string;
  /** Human-readable failure reason, or null when all is well. */
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Thin, single-utterance wrapper around the Web Speech API. One `start()`
 * captures one sentence: interim results stream into `transcript`, and once
 * the user pauses (`onend`) the finalized text is delivered via `onFinal`.
 * Reusable across the chat-mode dictation mic and the voice-first composer.
 */
export function useSpeechToText(opts?: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [supported] = useState(speechRecognitionSupported);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(opts?.onFinal);

  useEffect(() => {
    onFinalRef.current = opts?.onFinal;
  }, [opts?.onFinal]);

  useEffect(
    () => () => {
      recRef.current?.abort();
    },
    []
  );

  const start = useCallback(() => {
    if (!supported) return;
    stopSpeaking(); // never talk over the user

    setError(null);
    setTranscript("");
    finalRef.current = "";

    if (!recRef.current) {
      const rec = createSpeechRecognizer();
      rec.lang = "en-US";
      rec.continuous = false; // one utterance per start(); onend fires on pause
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => setListening(true);
      rec.onend = () => {
        setListening(false);
        const final = finalRef.current.trim();
        if (final) onFinalRef.current?.(final);
      };
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "aborted") return;
        setListening(false);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Microphone access is blocked. Allow it in your browser to use voice.");
        } else if (e.error === "network") {
          setError("Couldn't reach the speech service — check your connection and try again.");
        } else if (e.error === "no-speech") {
          setError("Didn't catch that. Tap the mic and try again.");
        } else {
          setError("Voice input failed. Tap the mic to try again.");
        }
      };
      rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalRef.current += result[0].transcript + " ";
          else interim += result[0].transcript;
        }
        setTranscript((finalRef.current + interim).trim());
      };

      recRef.current = rec;
    }

    try {
      recRef.current.start();
    } catch {
      // start() threw — almost always "already started", which is fine.
    }
  }, [supported]);

  const stop = useCallback(() => {
    // stop() lets the engine finalize interim results, then onend fires above.
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}