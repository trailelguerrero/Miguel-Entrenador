import { NextResponse } from "next/server";
import { z } from "zod";
import { answerWithRag, ensureSession, getRecentMessages, saveMessage } from "@/lib/rag";
import { ConfigError } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ChatRequest = z.object({
  message: z.string().trim().min(1, "El mensaje no puede estar vacío").max(4000),
  sessionId: z.uuid().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Petición no válida.", details: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { message } = parsed.data;

  try {
    const sessionId = await ensureSession(parsed.data.sessionId);
    const history = await getRecentMessages(sessionId);
    await saveMessage(sessionId, "user", message);

    const { answer, sources } = await answerWithRag(message, history);
    await saveMessage(sessionId, "assistant", answer);

    return NextResponse.json({ answer, sessionId, sources });
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[chat] Configuración incompleta:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[chat] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "No se pudo generar la respuesta. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
