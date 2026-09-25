import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/rag";
import { ConfigError } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IngestRequest = z.object({
  title: z.string().trim().min(1).max(300),
  text: z.string().trim().min(1).max(200_000),
  source: z.string().trim().max(1000).optional(),
});

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.INGEST_SECRET;
  if (!expected) {
    console.error("[ingest] Falta la variable de entorno INGEST_SECRET.");
    return NextResponse.json(
      { error: "Falta la variable de entorno INGEST_SECRET en el servidor." },
      { status: 500 }
    );
  }

  if (!secretMatches(req.headers.get("x-ingest-secret"), expected)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  const parsed = IngestRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Petición no válida.", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  try {
    const chunks = await ingestDocument(parsed.data);
    return NextResponse.json({ ok: true, chunks });
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[ingest] Configuración incompleta:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[ingest] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo ingerir el documento." }, { status: 500 });
  }
}
