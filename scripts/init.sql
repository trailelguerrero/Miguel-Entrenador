-- Miguel Entrenador: esquema de Supabase (Postgres + pgvector).
--   documents      → Biblioteca de Miguel (fragmentos + embeddings, RAG)
--   chat_sessions  → conversaciones con Miguel (se guardan con el botón del chat)
--   chat_messages  → mensajes de cada conversación
--   conversation_memory → intercambios (pregunta + respuesta) de las conversaciones
--                         guardadas, con embedding, para que Miguel las recuerde
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede ejecutar varias veces.

-- Extensiones necesarias
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Tabla de documentos vectorizados
create table if not exists public.documents (
  id bigint generated always as identity primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Sesiones de chat
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Mensajes de chat
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Columnas añadidas para guardar/cargar conversaciones desde la app
-- (add column if not exists: también actualiza tablas creadas con una versión anterior).
--   chat_sessions.title       → primera pregunta, para reconocer la conversación en la lista
--   chat_sessions.updated_at  → último guardado
--   chat_messages.metadata    → client_id (id del mensaje en el móvil, evita duplicados),
--                               timestamp original y documentos de la biblioteca citados
alter table public.chat_sessions add column if not exists title text;
alter table public.chat_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.chat_messages add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Memoria de conversaciones: cada intercambio guardado (pregunta del atleta +
-- respuesta de Miguel) con su embedding. Se crea al pulsar "Guardar en Supabase".
create table if not exists public.conversation_memory (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists chat_sessions_updated_idx
  on public.chat_sessions(updated_at desc);

-- Un mismo mensaje del móvil no se guarda dos veces en la misma conversación
create unique index if not exists chat_messages_client_id_idx
  on public.chat_messages(session_id, (metadata->>'client_id'))
  where metadata ? 'client_id';

create unique index if not exists conversation_memory_exchange_idx
  on public.conversation_memory(session_id, (metadata->>'client_id'));

create index if not exists conversation_memory_embedding_idx
  on public.conversation_memory
  using hnsw (embedding vector_cosine_ops);

create index if not exists chat_messages_session_idx
  on public.chat_messages(session_id, created_at);

-- HNSW en lugar de IVFFlat: no necesita datos previos para entrenarse, así que
-- funciona bien desde el primer documento.
create index if not exists documents_embedding_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops);

-- Búsquedas y borrados por título de documento
create index if not exists documents_title_idx
  on public.documents ((metadata->>'title'));

-- Seguridad: RLS activado y sin políticas para anon/authenticated, así que la
-- clave pública de Supabase no puede leer ni escribir nada. Solo el servidor de
-- la app (service_role) accede.
alter table public.documents enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.conversation_memory enable row level security;

drop policy if exists "service_role_documents_all" on public.documents;
create policy "service_role_documents_all"
  on public.documents
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_chat_sessions_all" on public.chat_sessions;
create policy "service_role_chat_sessions_all"
  on public.chat_sessions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_conversation_memory_all" on public.conversation_memory;
create policy "service_role_conversation_memory_all"
  on public.conversation_memory
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_chat_messages_all" on public.chat_messages;
create policy "service_role_chat_messages_all"
  on public.chat_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Versión anterior de la función (sin filtro por modelo), si existía
drop function if exists public.match_documents(vector, double precision, integer);

-- Búsqueda de fragmentos similares. filter_model limita la búsqueda a los
-- fragmentos vectorizados con el mismo proveedor/modelo de embeddings que la
-- consulta: vectores de modelos distintos no son comparables. Así, si se cambia
-- de proveedor (Gemini → OpenAI…), los documentos antiguos no se mezclan: hay
-- que volver a subirlos.
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer,
  filter_model text default null
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where
    d.embedding is not null
    and (filter_model is null or d.metadata->>'embedding_model' = filter_model)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_documents(vector, double precision, integer, text) from public, anon, authenticated;
grant execute on function public.match_documents(vector, double precision, integer, text) to service_role;

-- Intercambios de conversaciones anteriores parecidos a la pregunta. Excluye la
-- conversación abierta (Miguel ya la tiene entera) y los vectores de otro modelo.
create or replace function public.match_conversation_memory(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer,
  filter_model text default null,
  exclude_session uuid default null
)
returns table (
  id bigint,
  session_id uuid,
  session_title text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    m.id,
    m.session_id,
    s.title as session_title,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.conversation_memory m
  join public.chat_sessions s on s.id = m.session_id
  where
    m.embedding is not null
    and (filter_model is null or m.metadata->>'embedding_model' = filter_model)
    and (exclude_session is null or m.session_id <> exclude_session)
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_conversation_memory(vector, double precision, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.match_conversation_memory(vector, double precision, integer, text, uuid) to service_role;
