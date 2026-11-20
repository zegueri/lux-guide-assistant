import { describe, expect, it } from "vitest";
import {
  applyEvent,
  buildAnswerMarkdown,
  emptyAssistantMessage,
  toHistory,
  type AssistantChatMessage,
  type ChatMessage,
} from "@/lib/chat/assistant-message";
import type { ChatEvent, CitationInfo } from "@/lib/chat/protocol";

const citation = (sourceIndex: number): CitationInfo => ({
  sourceIndex,
  url: `https://lux-guide.github.io/#fiche/f${sourceIndex}`,
  title: `Fiche ${sourceIndex}`,
  citedText: "...",
  highlightUrl: `https://lux-guide.github.io/#fiche/f${sourceIndex}:~:text=x`,
});

function play(events: ChatEvent[]): AssistantChatMessage {
  return events.reduce(applyEvent, emptyAssistantMessage("a1"));
}

describe("applyEvent", () => {
  it("construit les blocs de texte et rattache les citations au bloc en cours", () => {
    const message = play([
      { type: "text-start" },
      { type: "text", text: "Les bus " },
      { type: "text", text: "sont gratuits." },
      { type: "citation", citation: citation(0) },
      { type: "text-start" },
      { type: "text", text: " Fin." },
      { type: "done", reason: "complete" },
    ]);
    expect(message.blocks).toEqual([
      { text: "Les bus sont gratuits.", citations: [citation(0)] },
      { text: " Fin.", citations: [] },
    ]);
    expect(message.status).toBe("done");
  });

  it("jette la réponse partielle en cas de refus", () => {
    const message = play([
      { type: "text-start" },
      { type: "text", text: "Début" },
      { type: "refusal", message: "Refusé." },
    ]);
    expect(message).toMatchObject({ blocks: [], status: "refusal", notice: "Refusé." });
  });

  it("garde le texte déjà reçu en cas d'erreur", () => {
    const message = play([
      { type: "text-start" },
      { type: "text", text: "Début" },
      { type: "error", message: "Coupure." },
    ]);
    expect(message).toMatchObject({ status: "error", notice: "Coupure." });
    expect(message.blocks[0]?.text).toBe("Début");
  });

  it("note l'absence de contexte", () => {
    expect(play([{ type: "done", reason: "no_context" }]).status).toBe("no_context");
  });

  it("ne modifie jamais le message d'origine", () => {
    const original = emptyAssistantMessage("a1");
    applyEvent(original, { type: "text-start" });
    expect(original.blocks).toEqual([]);
  });
});

describe("buildAnswerMarkdown", () => {
  it("numérote les sources dans l'ordre de leur première citation", () => {
    const { markdown, refs } = buildAnswerMarkdown([
      { text: "A.", citations: [citation(3)] },
      { text: " B.", citations: [citation(1), citation(3)] },
    ]);
    expect(markdown).toBe("A. [1](#cite-0) B. [2](#cite-1) [1](#cite-2)");
    expect(refs.map((r) => [r.number, r.citation.sourceIndex])).toEqual([
      [1, 3],
      [2, 1],
      [1, 3],
    ]);
  });

  it("place les pastilles avant les retours à la ligne de fin de bloc", () => {
    const { markdown } = buildAnswerMarkdown([
      { text: "- Premier point\n", citations: [citation(0)] },
      { text: "- Second point", citations: [] },
    ]);
    expect(markdown).toBe("- Premier point [1](#cite-0)\n- Second point");
  });

  it("n'affiche qu'une pastille par source dans un même bloc", () => {
    const { markdown } = buildAnswerMarkdown([{ text: "X", citations: [citation(0), citation(0)] }]);
    expect(markdown).toBe("X [1](#cite-0)");
  });
});

describe("toHistory", () => {
  it("garde les questions et les réponses abouties, en texte simple", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", text: "Question 1" },
      { ...play([{ type: "text-start" }, { type: "text", text: "Réponse 1" }, { type: "done", reason: "complete" }]), id: "a1" },
      { id: "u2", role: "user", text: "Question 2" },
      { ...play([{ type: "error", message: "x" }]), id: "a2" },
    ];
    expect(toHistory(messages)).toEqual([
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Réponse 1" },
      { role: "user", content: "Question 2" },
    ]);
  });

  it("ne garde que les 6 derniers messages", () => {
    const messages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      role: "user" as const,
      text: `Q${i}`,
    }));
    expect(toHistory(messages).map((m) => m.content)).toEqual(["Q4", "Q5", "Q6", "Q7", "Q8", "Q9"]);
  });
});
