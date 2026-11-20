import { describe, expect, it } from "vitest";
import { chatRequestSchema, encodeEvent, readEvents, type ChatEvent } from "@/lib/chat/protocol";

/** Flux qui livre le texte en morceaux arbitraires, comme le réseau. */
function streamOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of readEvents(stream)) out.push(e);
  return out;
}

describe("readEvents (NDJSON)", () => {
  it("reconstitue les lignes coupées entre deux morceaux réseau", async () => {
    const ndjson =
      encodeEvent({ type: "text-start" }) +
      encodeEvent({ type: "text", text: "Bonjour é" }) +
      encodeEvent({ type: "done", reason: "complete" });
    const pieces = [ndjson.slice(0, 7), ndjson.slice(7, 30), ndjson.slice(30)];
    expect(await collect(streamOf(pieces))).toEqual([
      { type: "text-start" },
      { type: "text", text: "Bonjour é" },
      { type: "done", reason: "complete" },
    ]);
  });

  it("accepte une dernière ligne sans retour à la ligne", async () => {
    expect(await collect(streamOf(['{"type":"text","text":"fin"}']))).toEqual([
      { type: "text", text: "fin" },
    ]);
  });
});

describe("chatRequestSchema", () => {
  it("accepte une question simple et met l'historique à vide par défaut", () => {
    expect(chatRequestSchema.parse({ question: "  Le bus est gratuit ?  " })).toEqual({
      question: "Le bus est gratuit ?",
      history: [],
    });
  });

  it("refuse une question vide ou trop longue", () => {
    expect(chatRequestSchema.safeParse({ question: " " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ question: "a".repeat(1001) }).success).toBe(false);
  });

  it("refuse un identifiant de fiche mal formé", () => {
    expect(
      chatRequestSchema.safeParse({ question: "ok ok", currentPageId: "../etc/passwd" }).success,
    ).toBe(false);
  });
});
