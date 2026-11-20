import { describe, expect, it } from "vitest";
import { buildMessages, SYSTEM_PROMPT, toSearchResults } from "@/lib/rag/prompt";
import type { RetrievedChunk } from "@/lib/rag/types";

const chunk: RetrievedChunk = {
  id: "transport:0",
  pageId: "transport",
  relatedPageId: null,
  kind: "fiche",
  url: "https://lux-guide.github.io/#fiche/transport",
  pageTitle: "Se déplacer",
  section: "Introduction",
  category: "Mobilité",
  paragraphs: ["Les transports publics sont gratuits.", "La première classe reste payante."],
  similarity: 0.85,
};

describe("toSearchResults", () => {
  it("crée un bloc search_result par passage, un bloc de texte par paragraphe", () => {
    expect(toSearchResults([chunk])).toEqual([
      {
        type: "search_result",
        source: "https://lux-guide.github.io/#fiche/transport",
        title: "Se déplacer — Introduction",
        content: [
          { type: "text", text: "Les transports publics sont gratuits." },
          { type: "text", text: "La première classe reste payante." },
        ],
        citations: { enabled: true },
      },
    ]);
  });
});

describe("buildMessages", () => {
  it("place les extraits puis la question dans le dernier message utilisateur", () => {
    const messages = buildMessages([], "Le bus est-il gratuit ?", [chunk]);
    expect(messages).toHaveLength(1);
    const last = messages[0]!;
    expect(last.role).toBe("user");
    if (typeof last.content === "string") throw new Error("contenu structuré attendu");
    expect(last.content.map((b) => b.type)).toEqual(["search_result", "text"]);
    expect(last.content.at(-1)).toEqual({ type: "text", text: "Le bus est-il gratuit ?" });
  });

  it("reprend l'historique en texte et le fait commencer par l'utilisateur", () => {
    const messages = buildMessages(
      [
        { role: "assistant", content: "Bonjour !" },
        { role: "user", content: "Le train est-il gratuit ?" },
        { role: "assistant", content: "Oui, en seconde classe." },
      ],
      "Et la première classe ?",
      [chunk],
    );
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[0]?.content).toBe("Le train est-il gratuit ?");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("impose les règles clés : sources seules, français, aveu d'ignorance", () => {
    expect(SYSTEM_PROMPT).toContain("Réponds uniquement avec ce qu'ils contiennent");
    expect(SYSTEM_PROMPT).toContain("Réponds en français");
    expect(SYSTEM_PROMPT).toContain("Le guide ne précise pas");
  });
});
