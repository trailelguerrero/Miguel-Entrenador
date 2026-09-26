import React, { useState } from 'react';
import { CloudUpload, CloudDownload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { ConversationService, isSavableMessage, type ConversationSummary } from '../services/api';
import { StorageService } from '../services/storage';

interface ChatCloudPanelProps {
  messages: ChatMessage[];
  /** Marca como guardados en Supabase los mensajes con estos ids. */
  onMarkSaved: (clientIds: string[], savedAt: string) => void;
  /** Sustituye el chat del dispositivo por una conversación cargada de Supabase. */
  onLoadConversation: (messages: ChatMessage[]) => void;
}

/**
 * Guardar y cargar conversaciones en Supabase a mano: el chat no se conecta a la
 * base de datos por su cuenta. Borrar el chat en el móvil nunca borra Supabase.
 */
export const ChatCloudPanel: React.FC<ChatCloudPanelProps> = ({ messages, onMarkSaved, onLoadConversation }) => {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pending = messages.filter((m) => isSavableMessage(m) && !m.savedAt);
  const currentSession = StorageService.getChatSessionId();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err: any) {
      setError(`${err.message}${err.hint ? ` — ${err.hint}` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () =>
    run(async () => {
      if (!pending.length && !currentSession) {
        setNotice('No hay mensajes nuevos que guardar.');
        return;
      }
      // Sin mensajes nuevos pero con conversación en Supabase: se llama igual para
      // completar la memoria de Miguel si un guardado anterior no pudo hacerlo.
      const result = await ConversationService.save(currentSession, pending);
      StorageService.setChatSessionId(result.sessionId);
      onMarkSaved(result.clientIds, new Date().toISOString());
      setNotice(
        (result.saved ? `Guardado en Supabase: ${result.saved} mensaje(s) nuevo(s).` : 'No había mensajes nuevos que guardar.') +
          (result.memoryIndexed ? ` Miguel podrá recordar ${result.memoryIndexed} intercambio(s) en otras conversaciones.` : ''),
      );
      if (result.memoryWarning) setError(result.memoryWarning);
    });

  const handleOpenList = () =>
    run(async () => {
      setList(await ConversationService.list());
    });

  const handleLoad = (c: ConversationSummary) => {
    if (pending.length && !confirm(`Tienes ${pending.length} mensaje(s) sin guardar en Supabase. Si cargas otra conversación, se quitarán de este dispositivo. ¿Continuar?`)) {
      return;
    }
    run(async () => {
      const loaded = await ConversationService.load(c.id);
      StorageService.setChatSessionId(c.id);
      onLoadConversation(loaded);
      setList(null);
      setNotice(`Conversación cargada (${loaded.length} mensajes). Lo nuevo que escribas se añadirá a ella al pulsar Guardar.`);
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-zinc-950 text-xs font-black flex items-center gap-1.5 disabled:opacity-40"
        >
          <CloudUpload className="w-4 h-4" />
          <span>Guardar en Supabase{pending.length ? ` (${pending.length})` : ''}</span>
        </button>
        <button
          onClick={handleOpenList}
          disabled={busy}
          className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-100 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
        >
          <CloudDownload className="w-4 h-4" />
          <span>Conversaciones guardadas</span>
        </button>
        <span className="text-[11px] text-zinc-500">
          {pending.length ? `${pending.length} mensaje(s) solo en este dispositivo` : 'Todo guardado'}
        </span>
      </div>

      {error && (
        <div className="flex items-start space-x-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start space-x-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {list && (
        <div className="border-t border-zinc-800 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black text-zinc-200">Conversaciones en Supabase ({list.length})</span>
            <button onClick={() => setList(null)} className="p-1 text-zinc-500 hover:text-zinc-200" title="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          {list.length === 0 && <p className="text-xs text-zinc-500">Aún no hay conversaciones guardadas.</p>}
          <ul className="divide-y divide-zinc-800 max-h-64 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => handleLoad(c)}
                  disabled={busy}
                  className="w-full text-left py-2 px-1 hover:bg-zinc-800/60 rounded-lg disabled:opacity-40"
                >
                  <p className="text-sm text-zinc-100 truncate">
                    {c.id === currentSession ? '● ' : ''}
                    {c.title || 'Conversación sin título'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {c.messageCount} mensaje(s) · {new Date(c.updatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
