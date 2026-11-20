/** Une section d'une page : un sous-titre (ou null pour l'introduction) et ses paragraphes. */
export interface Section {
  heading: string | null;
  paragraphs: string[];
}

export type PageKind = "fiche" | "faq";

/**
 * Une page du guide, telle qu'extraite par le crawler, avant découpage.
 * Une entrée de FAQ est traitée comme une petite page (une question, une réponse).
 */
export interface GuidePage {
  /** Identifiant stable : "frontalier" pour une fiche, "faq-..." pour une question. */
  pageId: string;
  kind: PageKind;
  /** URL qui ouvre la page sur le site, ex. https://lux-guide.github.io/#fiche/frontalier */
  url: string;
  title: string;
  category: string | null;
  /** Chapô de la fiche (phrase d'accroche), s'il existe. */
  summary: string | null;
  sections: Section[];
  /** Encadré « À retenir ». */
  keyPoints: string[];
  /** Pour une question de FAQ : la fiche vers laquelle elle renvoie. */
  relatedPageId: string | null;
}
