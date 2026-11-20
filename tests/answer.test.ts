import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@/lib/chat/protocol";
import { estimateCostUsd, REFUSAL_MESSAGE, toChatEvents, toSourceInfo } from "@/lib/rag/answer";
import type { RetrievedChunk } from "@/lib/rag/types";

type StreamEvent = Anthropic.Beta.BetaRawMessageStreamEvent;

const CHUNKS: RetrievedChunk[] = [
  {
    id: "frontalier:2",
    pageId: "frontalier",
    relatedPageId: null,
    kind: "fiche",
    url: "https://lux-guide.github.io/#fiche/frontalier",
    pageTitle: "Habiter en France",
    section: "Le télétravail a deux plafonds",
    category: "Logement",
    paragraphs: [
      "C'est le point qui surprend le plus.",
      "Le premier plafond est fiscal et se compte en jours par an.",
    ],
    similarity: 0.86,
  },
];

/** Fabrique un flux d'événements comme celui du SDK (seuls les champs lus sont remplis). */
async function* fakeStream(events: unknown[]): AsyncGenerator<StreamEvent> {
  for (const event of events) yield event as StreamEvent;
}

async function collect(events: unknown[]): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of toChatEvents(fakeStream(events), CHUNKS)) out.push(e);
  return out;
}

const start = { type: "message_start", message: { usage: { input_tokens: 1500 } } };
const textStart = { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } };
const thinkingStart = { type: "content_block_start", index: 0, content_block: { type: "thinking" } };
const text = (t: string) => ({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: t } });
const citation = {
  type: "content_block_delta",
  index: 1,
  delta: {
    type: "citations_delta",
    citation: {
      type: "search_result_location",
      cited_text: "Le premier plafond est fiscal et se compte en jours par an.",
      source: CHUNKS[0]!.url,
      title: "Habiter en France — Le télétravail a deux plafonds",
      search_result_index: 0,
      start_block_index: 1,
      end_block_index: 2,
    },
  },
};
const end = (stop_reason: string) => ({
  type: "message_delta",
  delta: { stop_reason },
  usage: { output_tokens: 400 },
});

describe("toChatEvents", () => {
  it("relaie le texte et les citations, ignore la réflexion", async () => {
    const events = await collect([start, thinkingStart, textStart, text("Le plafond "), text("fiscal."), citation, end("end_turn")]);
    expect(events.map((e) => e.type)).toEqual(["text-start", "text", "text", "citation", "done"]);
    expect(events[1]).toEqual({ type: "text", text: "Le plafond " });
  });

  it("ajoute à la citation un lien qui surligne le paragraphe cité", async () => {
    const events = await collect([textStart, citation, end("end_turn")]);
    const cited = events.find((e) => e.type === "citation");
    expect(cited).toMatchObject({
      type: "citation",
      citation: {
        sourceIndex: 0,
        url: "https://lux-guide.github.io/#fiche/frontalier",
        title: "Habiter en France — Le télétravail a deux plafonds",
      },
    });
    if (cited?.type !== "citation") throw new Error("citation attendue");
    expect(cited.citation.highlightUrl).toBe(
      "https://lux-guide.github.io/#fiche/frontalier:~:text=Le%20premier%20plafond%20est%20fiscal,compte%20en%20jours%20par%20an.",
    );
  });

  it("ignore une citation qui ne correspond à aucun passage", async () => {
    const bad = structuredClone(citation);
    bad.delta.citation.search_result_index = 9;
    expect((await collect([textStart, bad, end("end_turn")])).map((e) => e.type)).toEqual([
      "text-start",
      "done",
    ]);
  });

  it("termine par un événement done avec l'usage et le coût estimé", async () => {
    const events = await collect([start, textStart, text("ok"), end("end_turn")]);
    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "complete",
      usage: { inputTokens: 1500, outputTokens: 400, costUsd: 0.00035 },
    });
  });

  it("signale une réponse tronquée par max_tokens", async () => {
    const events = await collect([textStart, text("..."), end("max_tokens")]);
    expect(events.at(-1)).toMatchObject({ type: "done", reason: "max_tokens" });
  });

  it("transforme un refus en événement refusal, sans done", async () => {
    const events = await collect([textStart, text("Début de réponse"), end("refusal")]);
    expect(events.at(-1)).toEqual({ type: "refusal", message: REFUSAL_MESSAGE });
    expect(events.some((e) => e.type === "done")).toBe(false);
  });
});

describe("toSourceInfo", () => {
  it("résume chaque passage pour l'interface", () => {
    expect(toSourceInfo(CHUNKS)[0]).toEqual({
      index: 0,
      id: "frontalier:2",
      url: "https://lux-guide.github.io/#fiche/frontalier",
      pageTitle: "Habiter en France",
      section: "Le télétravail a deux plafonds",
      kind: "fiche",
      similarity: 0.86,
      excerpt: "C'est le point qui surprend le plus. Le premier plafond est fiscal et se compte en jours par an.",
    });
  });
});

describe("estimateCostUsd", () => {
  it("applique le tarif de Haiku 5.5 (0,10 $ / 0,50 $ par million de tokens)", () => {
    expect(estimateCostUsd(1_000_000, 0)).toBe(0.1);
    expect(estimateCostUsd(0, 1_000_000)).toBe(0.5);
  });
});
