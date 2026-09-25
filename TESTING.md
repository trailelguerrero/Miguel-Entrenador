# Pruebas

## 1. Instalación y build sin secretos

```bash
npm install
npm run build        # debe terminar sin errores aunque no exista .env.local
```

## 2. Health check

```bash
npm run build && npm start      # o: npm run dev
curl -s http://localhost:3000/api/health
# {"ok":true}
```

## 3. Validación y errores sin credenciales

Sin `.env.local`:

```bash
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"hola"}'
# 500 {"error":"Faltan variables de entorno de Supabase: ..."}

curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":""}'
# 400 {"error":"Petición no válida.", ...}
```

## 4. Protección de la ingesta

Con `INGEST_SECRET` definido:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" --data @sample-ingest.json
# 401

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" -H "x-ingest-secret: incorrecto" --data @sample-ingest.json
# 401
```

## 5. Integración real (requiere Supabase + OpenAI y `scripts/init.sql` ejecutado)

```bash
# Ingesta
curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" -H "x-ingest-secret: $INGEST_SECRET" \
  --data @sample-ingest.json
# {"ok":true,"chunks":N}

# Chat nuevo: crea sesión
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" \
  -d '{"message":"¿Qué es la base aeróbica?"}'
# {"answer":"...","sessionId":"<uuid>","sources":[{...}]}

# Pregunta fuera de los documentos
curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" \
  -d '{"message":"¿Cuál es la capital de Mongolia?","sessionId":"<uuid>"}'
# answer: "No tengo suficiente información ..." y sources: []
```

Comprobaciones en Supabase (SQL Editor):

```sql
select count(*) from documents;                                   -- > 0 tras ingerir
select id, created_at from chat_sessions order by created_at desc limit 5;
select role, left(content, 80) from chat_messages order by id desc limit 10;
```
