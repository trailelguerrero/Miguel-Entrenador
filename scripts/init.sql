-- Miguel Entrenador: esquema de Supabase (Postgres + pgvector).
-- Ejecutar en Supabase → SQL Editor. Es idempotente: puede ejecutarse varias veces.

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

-- Índices
create index if not exists chat_messages_session_idx
  on public.chat_messages(session_id, created_at);

-- HNSW en lugar de IVFFlat: no necesita datos previos para entrenar centroides,
-- así que da buen recall incluso con pocos documentos ingeridos.
create index if not exists documents_embedding_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops);

-- Seguridad: RLS activado. Sin políticas para anon/authenticated,
-- por lo que solo el backend (service_role) puede leer o escribir.
alter table public.documents enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Políticas para service_role
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

drop policy if exists "service_role_chat_messages_all" on public.chat_messages;
create policy "service_role_chat_messages_all"
  on public.chat_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Función para buscar documentos similares
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer
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
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Solo el backend puede invocar la búsqueda.
revoke execute on function public.match_documents(vector, double precision, integer) from public, anon, authenticated;
grant execute on function public.match_documents(vector, double precision, integer) to service_role;
