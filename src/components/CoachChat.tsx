import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  MessageSquare, 
  Sparkles, 
  User, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Heart, 
  Mountain, 
  Activity, 
  HelpCircle,
  ShieldCheck,
  Brain
} from 'lucide-react';
import { ChatMessage, AthleteProfile, DailyCheckIn, TargetRace, Workout } from '../types';

interface CoachChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, contextWorkoutId?: string) => Promise<void>;
  isLoading: boolean;
  profile: AthleteProfile;
  todayCheckIn?: DailyCheckIn;
  targetRace: TargetRace;
  recentWorkouts: Workout[];
  onClearHistory: () => void;
  /** Extrae evidencias de la conversación; quedan pendientes de confirmar en la Memoria. Devuelve cuántas. */
  onExtractEvidence?: () => Promise<number>;
  activeWorkoutContext?: Workout | null;
}

export const CoachChat: React.FC<CoachChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  profile,
  todayCheckIn,
  targetRace,
  recentWorkouts,
  onClearHistory,
  onExtractEvidence,
  activeWorkoutContext,
}) => {
  const [inputText, setInputText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const handleExtract = async () => {
    if (!onExtractEvidence || extracting) return;
    setExtracting(true);
    setExtractMsg(null);
    try {
      const n = await onExtractEvidence();
      setExtractMsg(n > 0 ? `${n} evidencia(s) pendiente(s) de confirmar en Memoria de Miguel.` : 'No he encontrado hechos nuevos que anotar en esta conversación.');
    } catch {
      setExtractMsg(null);
    } finally {
      setExtracting(false);
    }
  };
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const text = inputText;
    setInputText('');
    await onSendMessage(text, activeWorkoutContext?.id);
  };

  const handleQuickQuestion = async (q: string) => {
    if (isLoading) return;
    await onSendMessage(q, activeWorkoutContext?.id);
  };

  // Browser SpeechSynthesis for Miguel's voice
  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const quickPrompts = [
    { label: '📊 ¿Cómo va mi balance semanal?', query: 'Miguel, hazme un balance honesto de cómo llevo los entrenamientos y la carga esta semana.' },
    { label: '🫀 ¿Por qué insistir en la Zona 2?', query: `Explícame claro: ¿Por qué insistes tanto en que no supere mi AeT de ${profile.aetHr} bpm en los rodajes si me siento capaz de ir más rápido?` },
    { label: '⚡ Explicar ZoneSense', query: 'Explícame qué es ZoneSense de Suunto, cómo funciona y cómo usarlo en carrera para no reventar.' },
    { label: '💧 Pauta de hidratación y sudor', query: 'Miguel, analízame mi pauta de hidratación y tasa de sudoración para Transvulcania. ¿Cuántos ml y mg de sodio debo llevar en cada bidón?' },
    { label: '📉 ¿Cuándo necesito microciclo de descarga?', query: 'Miguel, analiza mi tendencia de fatiga acumulada semanal con los datos de HRV de mi Suunto. ¿Cuándo consideras que necesito meter un microciclo de descarga y cómo lo estructuramos?' },
    { label: '🏃 Generar Fartlek según mi estado actual', query: 'Miguel, quiero hacer un fartlek fisiológico pero sin inventar nada: debe respetar mi AeT de 142 bpm, mi HRV actual y la fase de la temporada. ¿Cuál es la mejor estructura para mí?' },
    { label: '🍌 Estrategia de nutrición y estómago', query: 'Miguel, explícame cómo usar la calculadora de nutrición y cómo progresar en la adaptación de mi estómago (SGLT1 y GLUT5) para llegar a 80g/h en Transvulcania sin náuseas.' },
    { label: '🌋 Preparar bajada de Transvulcania', query: '¿Cómo preparamos la bajada de 2.400m de Transvulcania a Tazacorte sin tener gimnasio?' },
    { label: '🦵 Siento piernas pesadas hoy', query: 'Siento las piernas bastante cargadas y fatiga muscular. ¿Mantenemos la sesión programada o ajustamos?' },
  ];

  return (
    <div className="flex flex-col h-[78vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Top Header */}
      <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-emerald-600 flex items-center justify-center text-zinc-950 font-black shadow-md">
              M
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full" title="Conectado y listo"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-base text-zinc-100">Miguel</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Tu Entrenador de Trail
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center space-x-1.5 mt-0.5">
              <span>Metodología Uphill Athlete</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Suunto ZoneSense</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          {activeWorkoutContext && (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-amber-300">
              <Activity className="w-3.5 h-3.5" />
              <span>Sesión activa: {activeWorkoutContext.title}</span>
            </div>
          )}

          {onExtractEvidence && messages.some((m) => m.role === 'user') && (
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="px-2.5 py-1.5 text-xs text-emerald-300 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center gap-1.5 disabled:opacity-50"
              title="Miguel propone lo que le has contado como evidencias; tú las confirmas en su Memoria"
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{extracting ? 'Leyendo…' : 'Anotar en memoria'}</span>
            </button>
          )}
          <button
            onClick={onClearHistory}
            className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800"
            title="Reiniciar conversación"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {extractMsg && (
        <div className="px-6 py-2 text-xs text-emerald-300 bg-emerald-950/30 border-b border-emerald-900/40">{extractMsg}</div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                    : 'bg-gradient-to-br from-amber-500 to-emerald-600 text-zinc-950 font-black'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : 'M'}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-zinc-950 font-medium rounded-tr-none'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-tl-none space-y-2'
                }`}
              >
                <div className="whitespace-pre-line">
                  {msg.content}
                </div>

                {!isUser && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[10px] text-zinc-500">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <button
                      onClick={() => speakMessage(msg.content)}
                      className="hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 flex items-center space-x-1"
                      title="Escuchar a Miguel"
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Escuchar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-emerald-600 text-zinc-950 font-black flex items-center justify-center text-xs">
              M
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 text-xs text-zinc-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Miguel está analizando tus datos y preparando la respuesta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-6 py-2 bg-zinc-950/60 border-t border-zinc-800/80 overflow-x-auto no-scrollbar flex space-x-2">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickQuestion(p.query)}
            disabled={isLoading}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 transition-all font-medium disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Habla con Miguel: sensaciones de la sesión, dudas de ritmos, molestias, Transvulcania..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
};
