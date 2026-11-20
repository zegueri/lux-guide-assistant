import { describe, expect, it } from "vitest";
import { buildHighlightUrl, encodeFragmentText } from "@/lib/rag/highlight";

const URL_FICHE = "https://lux-guide.github.io/#fiche/frontalier";

describe("buildHighlightUrl", () => {
  it("surligne un paragraphe court en entier", () => {
    expect(buildHighlightUrl(URL_FICHE, "Le salaire reste imposé au Luxembourg.")).toBe(
      `${URL_FICHE}:~:text=Le%20salaire%20reste%20impos%C3%A9%20au%20Luxembourg.`,
    );
  });

  it("utilise début et fin pour un paragraphe long", () => {
    const paragraph =
      "Le premier plafond est fiscal. Au-delà d'un certain nombre de jours, la part du salaire devient imposable.";
    expect(buildHighlightUrl(URL_FICHE, paragraph)).toBe(
      `${URL_FICHE}:~:text=Le%20premier%20plafond%20est%20fiscal.,part%20du%20salaire%20devient%20imposable.`,
    );
  });

  it("couvre plusieurs paragraphes, du début du premier à la fin du dernier", () => {
    const url = buildHighlightUrl(URL_FICHE, "Un deux trois quatre cinq six.", "Sept huit neuf dix onze douze.");
    expect(url).toBe(`${URL_FICHE}:~:text=Un%20deux%20trois%20quatre%20cinq,huit%20neuf%20dix%20onze%20douze.`);
  });

  it("retire le tiret des listes (le site affiche des puces)", () => {
    expect(buildHighlightUrl(URL_FICHE, "- Pièce d'identité\n- Bail signé")).toBe(
      `${URL_FICHE}:~:text=Pi%C3%A8ce%20d'identit%C3%A9`,
    );
  });

  it("renvoie l'URL simple si le texte est vide", () => {
    expect(buildHighlightUrl(URL_FICHE, "")).toBe(URL_FICHE);
  });
});

describe("encodeFragmentText", () => {
  it("encode les tirets et les virgules, réservés par la syntaxe", () => {
    expect(encodeFragmentText("Au-delà, oui")).toBe("Au%2Ddel%C3%A0%2C%20oui");
  });
});
