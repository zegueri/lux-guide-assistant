import * as cheerio from "cheerio";
import type { GuidePage, Section } from "./types";

/**
 * Extraction du contenu des pages rendues par le navigateur.
 * Le crawler récupère le HTML final (après exécution du JavaScript du site) ;
 * ces fonctions pures le transforment en objets structurés. Elles sont testées
 * avec des extraits HTML, sans navigateur.
 */

/** Remplace les suites d'espaces et de retours à la ligne par un seul espace. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** "Où déclarer son arrivée ?" -> "ou-declarer-son-arrivee" (identifiant stable). */
export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Analyse le HTML de `#fiche-detail` (une fiche affichée). */
export function parseFicheHtml(html: string, opts: { pageId: string; url: string }): GuidePage {
  const $ = cheerio.load(html);
  const title = cleanText($(".detail-hero h1").first().text());
  if (!title) throw new Error(`Fiche « ${opts.pageId} » : titre introuvable.`);
  const category = cleanText($(".detail-hero .cat").first().text()) || null;

  let summary: string | null = null;
  // La première section, sans sous-titre, reçoit les paragraphes d'introduction.
  const sections: Section[] = [{ heading: null, paragraphs: [] }];
  const current = () => sections[sections.length - 1]!;

  for (const el of $(".detail-texte").children().toArray()) {
    const node = $(el);
    const tag = el.tagName.toLowerCase();

    if (tag === "p" && node.hasClass("chapo")) {
      summary = cleanText(node.text()) || null;
    } else if (tag === "h2" || tag === "h3") {
      sections.push({ heading: cleanText(node.text()), paragraphs: [] });
    } else if (tag === "p") {
      const text = cleanText(node.text());
      if (text) current().paragraphs.push(text);
    } else if (tag === "ul" || tag === "ol") {
      // Une liste devient un seul paragraphe, un élément par ligne.
      const items = node
        .children("li")
        .toArray()
        .map((li) => cleanText($(li).text()))
        .filter(Boolean);
      if (items.length > 0) current().paragraphs.push(items.map((i) => `- ${i}`).join("\n"));
    }
    // Les autres blocs (astuces de la communauté, encadrés interactifs) sont ignorés :
    // on n'indexe que le texte vérifié de la fiche.
  }

  const keyPoints = $(".detail-cote .bloc.cle li")
    .toArray()
    .map((li) => cleanText($(li).text()))
    .filter(Boolean);

  return {
    pageId: opts.pageId,
    kind: "fiche",
    url: opts.url,
    title,
    category,
    summary,
    sections: sections.filter((s) => s.paragraphs.length > 0),
    keyPoints,
    relatedPageId: null,
  };
}

/**
 * Analyse le HTML de `#faq-liste` : des titres de groupe (`h2.faq-groupe`) suivis de
 * questions (`details.faq-item`). Chaque question devient une petite page.
 */
export function parseFaqHtml(
  html: string,
  opts: { url: string; ficheIdByTitle: ReadonlyMap<string, string> },
): GuidePage[] {
  const $ = cheerio.load(html);
  const pages: GuidePage[] = [];
  const seenIds = new Set<string>();
  let category: string | null = null;

  for (const el of $("h2.faq-groupe, details.faq-item").toArray()) {
    const node = $(el);
    if (el.tagName.toLowerCase() === "h2") {
      category = cleanText(node.text()) || null;
      continue;
    }

    const question = cleanText(node.children("summary").first().text());
    const answer = node
      .find(".faq-corps > p")
      .not(".faq-sources")
      .toArray()
      .map((p) => cleanText($(p).text()))
      .filter(Boolean);
    if (!question || answer.length === 0) continue;

    // Le bouton « Voir la fiche : Assurer son véhicule » indique la fiche liée.
    const chip = cleanText(node.find(".chip").first().text());
    const linkedTitle = chip.match(/Voir la fiche\s*:\s*(.+)$/)?.[1]?.trim();
    const relatedPageId = linkedTitle ? (opts.ficheIdByTitle.get(linkedTitle) ?? null) : null;

    let pageId = `faq-${slugify(question)}`;
    for (let n = 2; seenIds.has(pageId); n++) pageId = `faq-${slugify(question)}-${n}`;
    seenIds.add(pageId);

    pages.push({
      pageId,
      kind: "faq",
      url: opts.url,
      title: question,
      category,
      summary: null,
      sections: [{ heading: null, paragraphs: answer }],
      keyPoints: [],
      relatedPageId,
    });
  }
  return pages;
}
