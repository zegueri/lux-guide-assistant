import { describe, expect, it } from "vitest";
import type { GuidePage } from "@/lib/crawler/types";
import {
  chunkPage,
  embeddingInput,
  groupParagraphs,
  splitLongParagraph,
} from "@/lib/rag/chunker";

function fiche(overrides: Partial<GuidePage> = {}): GuidePage {
  return {
    pageId: "frontalier",
    kind: "fiche",
    url: "https://lux-guide.github.io/#fiche/frontalier",
    title: "Habiter en France",
    category: "Logement",
    summary: "Le salaire reste imposé au Luxembourg.",
    sections: [
      { heading: null, paragraphs: ["Intro 1."] },
      { heading: "Le télétravail", paragraphs: ["Deux plafonds.", "Fiscal et social."] },
    ],
    keyPoints: ["Deux seuils indépendants."],
    relatedPageId: null,
    ...overrides,
  };
}

describe("chunkPage", () => {
  const chunks = chunkPage(fiche());

  it("fait un morceau par section, plus l'encadré « À retenir »", () => {
    expect(chunks.map((c) => c.section)).toEqual(["Introduction", "Le télétravail", "À retenir"]);
  });

  it("place le chapô en tête de l'introduction", () => {
    expect(chunks[0]?.paragraphs).toEqual(["Le salaire reste imposé au Luxembourg.", "Intro 1."]);
  });

  it("garde l'URL, le titre, la catégorie et un identifiant stable", () => {
    expect(chunks[1]).toMatchObject({
      id: "frontalier:1",
      pageId: "frontalier",
      url: "https://lux-guide.github.io/#fiche/frontalier",
      pageTitle: "Habiter en France",
      category: "Logement",
      kind: "fiche",
    });
  });

  it("crée un morceau d'introduction même sans paragraphe avant le premier sous-titre", () => {
    const page = fiche({ sections: [{ heading: "A", paragraphs: ["x"] }], keyPoints: [] });
    expect(chunkPage(page).map((c) => [c.section, c.paragraphs])).toEqual([
      ["Introduction", ["Le salaire reste imposé au Luxembourg."]],
      ["A", ["x"]],
    ]);
  });

  it("ne donne pas de section « Introduction » à une question de FAQ", () => {
    const faq = fiche({
      kind: "faq",
      summary: null,
      keyPoints: [],
      sections: [{ heading: null, paragraphs: ["Réponse."] }],
    });
    expect(chunkPage(faq)[0]?.section).toBeNull();
  });

  it("préfixe le texte vectorisé par le titre et la section", () => {
    expect(embeddingInput(chunks[1]!)).toBe(
      "Habiter en France — Le télétravail\nDeux plafonds.\n\nFiscal et social.",
    );
  });
});

describe("groupParagraphs", () => {
  const p = (n: number, size = 100) => `${String(n)}`.padEnd(size, ".");

  it("regroupe tant que la limite n'est pas atteinte", () => {
    expect(groupParagraphs([p(1), p(2)], { maxChars: 500, overlapParagraphs: 1 })).toHaveLength(1);
  });

  it("coupe une section trop longue, avec un paragraphe de recouvrement", () => {
    const windows = groupParagraphs([p(1), p(2), p(3), p(4)], { maxChars: 210, overlapParagraphs: 1 });
    expect(windows.map((w) => w.map((x) => x[0]))).toEqual([
      ["1", "2"],
      ["2", "3"],
      ["3", "4"],
    ]);
    for (const w of windows) expect(w.join("\n\n").length).toBeLessThanOrEqual(210);
  });

  it("avance toujours, même sans recouvrement possible", () => {
    const windows = groupParagraphs([p(1, 300), p(2, 300)], { maxChars: 350, overlapParagraphs: 1 });
    expect(windows.map((w) => w.length)).toEqual([1, 1]);
  });
});

describe("splitLongParagraph", () => {
  it("coupe entre deux phrases", () => {
    const text = "Première phrase assez longue. Deuxième phrase assez longue. Troisième.";
    const parts = splitLongParagraph(text, 40);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(" ")).toBe(text);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(40);
  });

  it("laisse intact un paragraphe court", () => {
    expect(splitLongParagraph("Court.", 100)).toEqual(["Court."]);
  });
});
