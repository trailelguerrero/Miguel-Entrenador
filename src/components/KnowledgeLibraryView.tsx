import React, { useEffect, useState } from 'react';
import { BookOpen, Upload, Trash2, RefreshCw, AlertCircle, CheckCircle2, Eye, X } from 'lucide-react';
import { ApiService, KnowledgeService, type KnowledgeDocument, type KnowledgeStatus } from '../services/api';

const MAX_CHARS = 200_000;

export const KnowledgeLibraryView: React.FC = () => {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[] | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ title: string; source: string | null; chunks: string[] } | null>(null);

  useEffect(() => {
    ApiService.getHealth()
      .then((h) => {
        setStatus(h.knowledge ?? null);
        // La lista se carga sola al abrir la biblioteca
        if (h.knowledge?.enabled) loadDocuments();
      })
      .catch(() => setStatus(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleView = (docTitle: string) =>
    run(async () => {
      setViewing(await KnowledgeService.content(docTitle));
    });

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

  const loadDocuments = () =>
    run(async () => {
      setDocuments(await KnowledgeService.list());
    });

  /** Solo texto: .md, .markdown o .txt (sin filtro en el selector: en el iPhone el filtro deja los .md en gris). */
  const isTextFile = (f: File) => /\.(md|markdown|txt)$/i.test(f.name) || f.type.startsWith('text/');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const rejected = files.filter((f) => !isTextFile(f)).map((f) => f.name);
    const ok = files.filter(isTextFile);
    if (rejected.length) setError(`Solo archivos de texto (.md, .txt). No se cargan: ${rejected.join(', ')}. Un PDF, pásalo antes a texto.`);
    if (!ok.length) return;
    // Un archivo: se rellena el formulario para revisarlo antes de guardar
    if (ok.length === 1) {
      const file = ok[0];
      setText(await file.text());
      setTitle(file.name.replace(/\.[^.]+$/, ''));
      setSource(file.name);
      return;
    }
    // Varios: se suben directamente, cada uno con el nombre del archivo como título
    await run(async () => {
      const done: string[] = [];
      const failed: string[] = rejected.map((n) => `${n} (no es texto)`);
      for (const file of ok) {
        const content = await file.text();
        const docTitle = file.name.replace(/\.[^.]+$/, '');
        if (!content.trim() || content.length > MAX_CHARS) {
          failed.push(`${file.name} (${content.trim() ? 'demasiado largo: divídelo' : 'vacío'})`);
          continue;
        }
        try {
          const r = await KnowledgeService.ingest({ title: docTitle, text: content, source: file.name });
          done.push(`${docTitle} (${r.chunks} fragmentos${r.replaced ? ', sustituye al anterior' : ''})`);
        } catch (err: any) {
          failed.push(`${file.name} (${err.message})`);
        }
      }
      setDocuments(await KnowledgeService.list());
      if (done.length) setNotice(`Guardados en la biblioteca: ${done.join(' · ')}`);
      if (failed.length) setError(`No se guardaron: ${failed.join(' · ')}`);
    });
  };

  const handleIngest = () =>
    run(async () => {
      const result = await KnowledgeService.ingest({ title: title.trim(), text, source: source.trim() || undefined });
      setNotice(
        `"${title.trim()}" guardado en ${result.chunks} fragmento(s)${result.replaced ? ` (sustituye a la versión anterior)` : ''}.`,
      );
      setTitle('');
      setSource('');
      setText('');
      setDocuments(await KnowledgeService.list());
    });

  const handleDelete = (docTitle: string) => {
    if (!confirm(`¿Borrar "${docTitle}" de la Biblioteca de Miguel? No se puede deshacer.`)) return;
    run(async () => {
      const deleted = await KnowledgeService.remove(docTitle);
      setNotice(`"${docTitle}" borrado (${deleted} fragmento(s)).`);
      setDocuments(await KnowledgeService.list());
    });
  };

  const tooLong = text.length > MAX_CHARS;
  const canIngest = !busy && !!title.trim() && !!text.trim() && !tooLong;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-800/50 rounded-3xl p-6 shadow-xl space-y-3">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-100">Biblioteca de Miguel</h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Documentos de referencia (manuales, apuntes, planes de tu entrenador…) que Miguel consulta en el chat.
              Cuando se apoya en uno, lo cita debajo de su respuesta. No sustituyen a tus datos de Suunto ni a tu historial .md.
            </p>
          </div>
        </div>

        {status && !status.enabled && (
          <div className="flex items-start space-x-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Biblioteca desactivada: falta {status.missing.join(', ')} en Vercel. Miguel responde sin ella hasta que se configure
              (sección 10 de CONFIGURACION-POR-USUARIO.md).
            </span>
          </div>
        )}
        {status?.enabled && (
          <p className="text-[11px] text-zinc-500">Embeddings: {status.embeddingModel}</p>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">Protegida con la sesión de la app: no hace falta escribir ninguna clave.</span>
        <button
          onClick={loadDocuments}
          disabled={busy}
          className="shrink-0 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-100 text-xs font-bold disabled:opacity-40 flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          <span>Recargar lista</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start space-x-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start space-x-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
        <h4 className="text-sm font-black text-zinc-100">Añadir documento</h4>
        <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-black text-zinc-950 cursor-pointer">
          <Upload className="w-4 h-4" />
          <span>Buscar archivos en el dispositivo (.md, .txt)</span>
          <input type="file" multiple onChange={handleFile} className="hidden" />
        </label>
        <p className="text-[11px] text-zinc-500">
          Uno: se carga abajo para revisar el título antes de guardar. Varios: se guardan directamente con el nombre de cada archivo.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (si ya existe, se sustituye)"
          maxLength={300}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Fuente (opcional: libro, autor, web…)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…o pega aquí el texto"
          rows={8}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[11px] ${tooLong ? 'text-red-400' : 'text-zinc-500'}`}>
            {text.length.toLocaleString('es-ES')} / {MAX_CHARS.toLocaleString('es-ES')} caracteres
            {tooLong ? ' — divídelo en varias partes' : ''}
          </span>
          <button
            onClick={handleIngest}
            disabled={!canIngest}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-zinc-950 text-xs font-black disabled:opacity-40"
          >
            {busy ? 'Guardando…' : 'Guardar en la biblioteca'}
          </button>
        </div>
      </div>

      {documents && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <h4 className="text-sm font-black text-zinc-100">Documentos ({documents.length})</h4>
          {documents.length === 0 && <p className="text-xs text-zinc-500">La biblioteca está vacía.</p>}
          {status?.enabled && documents.some((d) => d.embeddingModel && d.embeddingModel !== status.embeddingModel) && (
            <p className="text-[11px] text-amber-300">
              Hay documentos vectorizados con otro modelo de embeddings: Miguel no los encuentra. Vuelve a subirlos.
            </p>
          )}
          <ul className="divide-y divide-zinc-800">
            {documents.map((d) => (
              <li key={d.title} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 truncate">{d.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {d.chunks} fragmento(s){d.source ? ` · ${d.source}` : ''} · {new Date(d.createdAt).toLocaleDateString('es-ES')}
                    {d.embeddingModel ? ` · ${d.embeddingModel}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleView(d.title)}
                  disabled={busy}
                  className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-40"
                  title="Ver contenido"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(d.title)}
                  disabled={busy}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-40"
                  title="Borrar documento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewing && (
        <div className="bg-zinc-900 border border-emerald-800/50 rounded-3xl p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-black text-zinc-100 truncate">{viewing.title}</h4>
              <p className="text-[11px] text-zinc-500">
                {viewing.chunks.length} fragmento(s){viewing.source ? ` · ${viewing.source}` : ''}. Es lo que Miguel puede consultar; al trocear, unas líneas se repiten entre fragmentos.
              </p>
            </div>
            <button onClick={() => setViewing(null)} className="p-1.5 text-zinc-500 hover:text-zinc-200" title="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {viewing.chunks.map((c, i) => (
              <div key={i} className="text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <span className="block text-[10px] text-zinc-500 mb-1">Fragmento {i + 1}</span>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
