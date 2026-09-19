import { useState, useRef, useCallback } from 'react';

export type RecognitionState = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoiceAssistant() {
  const [state, setState] = useState<RecognitionState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startListening = useCallback((): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            resolve(base64Data);
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setState('listening');
      } catch (err) {
        setState('idle');
        reject(err);
      }
    });
  }, []);

  const playAudioBase64 = useCallback((base64Audio: string, mimeType: string = 'audio/wav') => {
    setState('speaking');
    const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
    audio.onended = () => setState('idle');
    audio.onerror = () => setState('idle');
    audio.play();
  }, []);

  const speak = useCallback((text: string) => {
    setState('speaking');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'hi-IN';
    u.onend = () => setState('idle');
    u.onerror = () => setState('idle');
    window.speechSynthesis.speak(u);
  }, []);

  return { state, setState, startListening, stopListening, playAudioBase64, speak };
}
