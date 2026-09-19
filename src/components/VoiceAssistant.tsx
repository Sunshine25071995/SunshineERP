import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Loader2, Volume2 } from 'lucide-react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { parseVoiceCommand, executeAction, VoiceContext } from '../services/voiceAgent';
import { dbService } from '../payment-tracker/db';
import { User, JobCard } from '../types';

interface VoiceAssistantProps {
  currentUser: User;
  jobCards: JobCard[];
  selectedJobCardId?: string;
  selectedJobCardCode?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export function VoiceAssistant({ currentUser, jobCards, selectedJobCardId, selectedJobCardCode }: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '🎤 Namaste! Bolein kya karna hai.\n\nExamples:\n• "67.500 ka roll add karo"\n• "35.500 wastage add karo"\n• "Label Graphic ke 50000 aaye"\n• "Label Graphic ka WhatsApp report bhejo"', ts: Date.now() }
  ]);
  const [parties, setParties] = useState<any[]>([]);
  const { state, setState, transcript, setTranscript, isSupported, startListening, stopListening, speak } = useVoiceAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  useEffect(() => {
    if (isOpen && parties.length === 0) {
      dbService.getParties().then(setParties).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'user' | 'assistant', text: string) => {
    setMessages(prev => [...prev, { role, text, ts: Date.now() }]);
  };

  const handleVoicePress = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }
    if (isProcessing) return;

    try {
      setState('listening');
      const userText = await startListening();
      if (!userText.trim()) return;

      addMessage('user', `🎤 ${userText}`);
      setState('processing');
      setTranscript('');

      const context: VoiceContext = {
        currentUser: {
          loginId: currentUser.loginId,
          shift: currentUser.shift,
          department: currentUser.department,
        },
        selectedJobCardId,
        selectedJobCardCode,
        jobCards: jobCards.map(j => ({ id: j.id, jobCode: j.jobCode, partyCode: j.partyCode, status: j.status })),
        paymentParties: parties,
      };

      const action = await parseVoiceCommand(userText, context);
      const result = await executeAction(action, context);

      addMessage('assistant', result);
      speak(result.replace(/[*✅❌📤➡️]/gu, ''));
    } catch (err: any) {
      const errMsg = err?.message?.includes('not-allowed')
        ? '❌ Microphone permission denied. Please allow microphone access in browser settings.'
        : `❌ Error: ${err?.message || 'Unknown error'}`;
      addMessage('assistant', errMsg);
      setState('idle');
    }
  }, [isListening, isProcessing, startListening, stopListening, setState, currentUser, jobCards, selectedJobCardId, selectedJobCardCode, parties]);

  const handleTextSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('textInput') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', `💬 ${text}`);
    setState('processing');

    const context: VoiceContext = {
      currentUser: { loginId: currentUser.loginId, shift: currentUser.shift, department: currentUser.department },
      selectedJobCardId,
      selectedJobCardCode,
      jobCards: jobCards.map(j => ({ id: j.id, jobCode: j.jobCode, partyCode: j.partyCode, status: j.status })),
      paymentParties: parties,
    };

    const action = await parseVoiceCommand(text, context);
    const result = await executeAction(action, context);
    addMessage('assistant', result);
    setState('idle');
  }, [currentUser, jobCards, selectedJobCardId, selectedJobCardCode, parties]);

  if (!isSupported && !isOpen) {
    return null; // Silently hide on unsupported browsers
  }

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 md:bottom-6
          ${isListening
            ? 'bg-red-500 scale-110 animate-pulse'
            : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:scale-105 hover:shadow-indigo-500/50'
          }`}
        title="AI Voice Assistant"
      >
        {isListening ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : isProcessing ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
        {/* Ripple effect when listening */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping delay-100" />
          </>
        )}
      </button>

      {/* Assistant Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-sm md:max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${state === 'speaking' ? 'animate-pulse' : ''}`}>
                {state === 'speaking' ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">AI Voice Assistant</p>
                <p className="text-xs text-blue-200">
                  {state === 'idle' && 'Tap mic ya type karein'}
                  {state === 'listening' && '🎙️ Sun raha hoon...'}
                  {state === 'processing' && '🤔 Soch raha hoon...'}
                  {state === 'speaking' && '🔊 Bol raha hoon...'}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Transcript */}
            {transcript && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm text-blue-700 italic">
                🎤 "{transcript}"
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-gray-200 flex items-center gap-2">
              <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                <input
                  name="textInput"
                  type="text"
                  placeholder="Type ya bolein..."
                  disabled={isProcessing}
                  className="flex-1 text-sm bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
              <button
                onClick={handleVoicePress}
                disabled={isProcessing}
                className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition-all disabled:opacity-50 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
