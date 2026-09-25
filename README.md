# Miguel Entrenador

Asistente conversacional de trail running basado en **RAG** (Retrieval-Augmented Generation).

## Qué es (y qué no es)

- **Es** un asistente conversacional que responde usando **datos propios**: documentos que tú ingieres,
  se trocean, se convierten en embeddings y se guardan en una **base vectorial** (Supabase Postgres + pgvector).
  En cada pregunta se recuperan los fragmentos más parecidos y se envían como contexto a un LLM externo (OpenAI).
- **No es** un modelo entrenado desde cero ni un modelo ajustado (fine-tuned). El "conocimiento" de Miguel
  es exactamente lo que hayas ingerido; el LLM solo redacta la respuesta a partir de ese contexto.
- Si no se encuentran fragmentos relevantes, responde que **no tiene suficiente información** (sin llamar al LLM).
  El system prompt prohíbe inventar datos, pero ningún LLM es infalible: revisa las fuentes que muestra cada respuesta.
- No da consejo médico.

La implementación anterior (Vite + Express + Gemini + integración Suunto) se conserva sin cambios en [`legacy/`](legacy/).

## Arquitectura

```
Navegador (app/page.tsx)
   │  POST /api/chat { message, sessionId? }
   ▼
Next.js Route Handlers (Vercel Serverless, runtime Node)
   ├─ /api/chat    → sesión + historial (8 últimos) → embedding de la pregunta
   │                 → match_documents (pgvector) → OpenAI chat → guarda respuesta
   ├─ /api/ingest  → protegido con x-ingest-secret → trocea → embeddings → documents
   └─ /api/health  → { ok: true }
   │
   ├─ Supabase Postgres + pgvector: documents, chat_sessions, chat_messages
   └─ OpenAI: text-embedding-3-small (1536 dim) + gpt-4o-mini (configurables)
```

| Archivo | Función |
| --- | --- |
| `app/page.tsx` | Chat en React (cliente). Guarda `sessionId` en `localStorage`. |
| `app/api/chat/route.ts` | Endpoint de chat RAG. |
| `app/api/ingest/route.ts` | Ingesta protegida de documentos. |
| `app/api/health/route.ts` | Health check. |
| `lib/rag.ts` | Sesiones, historial, recuperación, generación e ingesta. |
| `lib/chunker.ts` | Troceado de texto con solapamiento. |
| `lib/openai.ts` | Cliente OpenAI perezoso y embeddings por lotes. |
| `lib/supabaseAdmin.ts` | Cliente Supabase (service role) perezoso, solo servidor. |
| `scripts/init.sql` | Esquema, índices, RLS y función `match_documents`. |

Los clientes de Supabase y OpenAI se crean de forma perezosa: `npm run build` funciona **sin variables de entorno**.
Si faltan en tiempo de ejecución, las rutas API devuelven un error 500 con un mensaje claro.

## Requisitos

- Node.js 20 o superior.
- Un proyecto de [Supabase](https://supabase.com) (plan gratuito válido).
- Una API key de [OpenAI](https://platform.openai.com).

## Variables de entorno

Copia `.env.local.example` a `.env.local` y rellénalo:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase (`https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave `service_role`. **Solo servidor.** Nunca en el cliente. |
| `OPENAI_API_KEY` | Sí | API key de OpenAI. **Solo servidor.** |
| `OPENAI_EMBEDDING_MODEL` | No | Por defecto `text-embedding-3-small`. Debe admitir 1536 dimensiones. |
| `OPENAI_CHAT_MODEL` | No | Por defecto `gpt-4o-mini`. |
| `INGEST_SECRET` | Sí (para ingerir) | Secreto largo y aleatorio exigido en la cabecera `x-ingest-secret`. |

> ⚠️ **No subas secretos al repositorio.** `.env.local` y cualquier `.env*` (salvo `.env.local.example`) están en `.gitignore`.
> Si alguna vez se sube una clave por error, **rótala** inmediatamente en Supabase/OpenAI.

Generar un `INGEST_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Base de datos

1. En Supabase → **SQL Editor**, pega y ejecuta el contenido de [`scripts/init.sql`](scripts/init.sql).
   Es idempotente: se puede volver a ejecutar sin romper nada.
2. Crea: extensiones `vector` y `pgcrypto`, tablas `documents`, `chat_sessions`, `chat_messages`,
   índice HNSW sobre los embeddings, RLS activado (solo `service_role` accede) y la función `match_documents`.

## Ejecutar en local

```bash
npm install
cp .env.local.example .env.local   # y rellena los valores
npm run dev                        # http://localhost:3000
```

Build de producción:

```bash
npm run build
npm start
```

## Ingerir documentos

`POST /api/ingest` con cabecera `x-ingest-secret` y cuerpo JSON:

```json
{ "title": "Título", "text": "Texto completo", "source": "opcional" }
```

Ejemplo con el documento de muestra:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  --data @sample-ingest.json
# → {"ok":true,"chunks":2}
```

- Sin cabecera o con un secreto incorrecto → `401`.
- Texto máximo por petición: 200 000 caracteres. Para documentos más grandes, divídelos en varias peticiones
  (cada invocación serverless debe terminar dentro del límite de tiempo de Vercel).
- Cada ingesta **añade** filas; no deduplica. Para reemplazar un documento, borra antes sus filas
  (`delete from documents where metadata->>'title' = '...'`).

## Chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"¿Cómo estructuro la semana?"}'
# → {"answer":"...","sessionId":"<uuid>","sources":[...]}
```

Envía el `sessionId` devuelto en las siguientes peticiones para mantener la conversación.
Si el `sessionId` no existe en la base de datos, se crea una sesión nueva.

## Despliegue en Vercel

1. Importa el repositorio en Vercel (**Add New → Project**). Framework detectado: **Next.js**.
   Build command y output directory: los de por defecto.
2. En **Settings → Environment Variables** añade las variables de la tabla anterior (Production y Preview).
3. Despliega. No hace falta Docker, ni procesos persistentes, ni disco local: todo el estado vive en Supabase.
4. Comprueba `https://<tu-dominio>/api/health` → `{"ok":true}` e ingiere documentos contra la URL de producción.

Las rutas `/api/chat` e `/api/ingest` declaran `maxDuration = 60` segundos.

## Pruebas

Ver [`TESTING.md`](TESTING.md).
