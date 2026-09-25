"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface Source {
  id: number;
  title: string | null;
  source: string | null;
  similarity: number;
  excerpt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const SESSION_KEY = "miguel-entrenador:sessionId";

function readSessionId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // localStorage no disponible (modo privado, etc.): la sesión dura solo esta visita.
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(readSessionId());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { message: text, sessionId } : { message: text }),
      });

      const data = (await res.json().catch(() => null)) as
        | { answer?: string; sessionId?: string; sources?: Source[]; error?: string }
        | null;

      if (!res.ok || !data?.answer) {
        throw new Error(data?.error || `Error del servidor (${res.status}).`);
      }

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        writeSessionId(data.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer!, sources: data.sources ?? [] },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
      // Devuelve el texto al input para poder reintentar.
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function newConversation() {
    setMessages([]);
    setError(null);
    setSessionId(null);
    writeSessionId(null);
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <div>
          <h1>Miguel Entrenador</h1>
          <p>Asistente RAG: responde solo con los documentos ingeridos.</p>
        </div>
        <button type="button" className="link-button" onClick={newConversation}>
          Nueva conversación
        </button>
      </header>

      <section className="messages" aria-live="polite">
        {messages.length === 0 && !loading && (
          <p className="empty">Pregunta algo sobre tu entrenamiento.</p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <details className="sources">
                <summary>Fuentes ({m.sources.length})</summary>
                <ol>
                  {m.sources.map((s) => (
                    <li key={s.id}>
                      <strong>{s.title ?? "Sin título"}</strong>
                      {s.source ? ` · ${s.source}` : ""} · similitud {s.similarity.toFixed(2)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}

        {loading && <div className="bubble assistant loading">Miguel está pensando…</div>}
        <div ref={bottomRef} />
      </section>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <form className="composer" onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta…"
          rows={2}
          maxLength={4000}
          disabled={loading}
          aria-label="Mensaje"
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Enviar
        </button>
      </form>
    </main>
  );
}
