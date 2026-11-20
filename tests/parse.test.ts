import { describe, expect, it } from "vitest";
import { cleanText, parseFaqHtml, parseFicheHtml, slugify } from "@/lib/crawler/parse";

// Extrait simplifié du HTML rendu par le site (même structure de classes).
const FICHE_HTML = `
  <div class="detail-hero"><div class="titre"><div class="cat">Administratif</div>
    <h1>Les huit premiers jours</h1></div></div>
  <button class="back">← Toutes les fiches</button>
  <div class="detail-corps">
    <div class="detail-texte">
      <p class="chapo">Tout part de la commune.</p>
      <p>La première démarche   est la commune.</p>
      <h2>Trois délais, pas un seul</h2>
      <p>Huit jours pour déclarer son arrivée.</p>
      <ul><li>Pièce d'identité</li><li>Bail signé</li></ul>
      <div class="communaute"><p>Astuce non vérifiée</p></div>
    </div>
    <div class="detail-cote">
      <div class="bloc cle"><h4>À retenir</h4><ul><li>Huit jours.</li><li>Le matricule vient de la commune.</li></ul></div>
      <div class="bloc"><h4>Sources officielles</h4><a href="https://guichet.public.lu">Guichet.lu</a></div>
    </div>
  </div>`;

const FAQ_HTML = `
  <h2 class="faq-groupe">Mobilité</h2>
  <details class="faq-item"><summary>Faut-il un relevé d'information ?</summary>
    <div class="faq-corps"><p>Il n'est pas exigé.</p>
      <div class="chips"><button class="chip">Voir la fiche : Assurer son véhicule</button></div>
      <p class="faq-sources">Sources : CAA</p></div></details>
  <h2 class="faq-groupe">Logement</h2>
  <details class="faq-item"><summary>Quel délai pour déclarer son arrivée ?</summary>
    <div class="faq-corps"><p>Huit jours.</p></div></details>`;

describe("parseFicheHtml", () => {
  const page = parseFicheHtml(FICHE_HTML, {
    pageId: "arrivee",
    url: "https://lux-guide.github.io/#fiche/arrivee",
  });

  it("extrait titre, catégorie et chapô", () => {
    expect(page.title).toBe("Les huit premiers jours");
    expect(page.category).toBe("Administratif");
    expect(page.summary).toBe("Tout part de la commune.");
  });

  it("découpe le corps par sous-titre et normalise les espaces", () => {
    expect(page.sections).toEqual([
      { heading: null, paragraphs: ["La première démarche est la commune."] },
      {
        heading: "Trois délais, pas un seul",
        paragraphs: ["Huit jours pour déclarer son arrivée.", "- Pièce d'identité\n- Bail signé"],
      },
    ]);
  });

  it("ignore les astuces de la communauté et lit l'encadré « À retenir »", () => {
    expect(JSON.stringify(page.sections)).not.toContain("Astuce non vérifiée");
    expect(page.keyPoints).toEqual(["Huit jours.", "Le matricule vient de la commune."]);
  });

  it("échoue clairement si la fiche n'a pas de titre", () => {
    expect(() => parseFicheHtml("<div></div>", { pageId: "x", url: "u" })).toThrow(/titre/);
  });
});

describe("parseFaqHtml", () => {
  const pages = parseFaqHtml(FAQ_HTML, {
    url: "https://lux-guide.github.io/#faq",
    ficheIdByTitle: new Map([["Assurer son véhicule", "assurance_auto"]]),
  });

  it("crée une page par question, avec sa catégorie", () => {
    expect(pages.map((p) => [p.title, p.category])).toEqual([
      ["Faut-il un relevé d'information ?", "Mobilité"],
      ["Quel délai pour déclarer son arrivée ?", "Logement"],
    ]);
  });

  it("garde la réponse sans la ligne des sources", () => {
    expect(pages[0]?.sections[0]?.paragraphs).toEqual(["Il n'est pas exigé."]);
  });

  it("relie la question à sa fiche grâce au bouton « Voir la fiche »", () => {
    expect(pages[0]?.relatedPageId).toBe("assurance_auto");
    expect(pages[1]?.relatedPageId).toBeNull();
  });

  it("donne un identifiant stable dérivé de la question", () => {
    expect(pages[1]?.pageId).toBe("faq-quel-delai-pour-declarer-son-arrivee");
  });
});

describe("utilitaires de texte", () => {
  it("cleanText fusionne les espaces", () => {
    expect(cleanText("  a \n\t b  ")).toBe("a b");
  });
  it("slugify retire accents et ponctuation", () => {
    expect(slugify("Où déclarer l'arrivée ?")).toBe("ou-declarer-l-arrivee");
  });
});
