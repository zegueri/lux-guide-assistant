/**
 * Liens qui surlignent un passage : les « text fragments » (#:~:text=début,fin).
 *
 * Exemple : https://lux-guide.github.io/#fiche/frontalier:~:text=Le%20premier%20plafond,pas%20en%20jours.
 * Le navigateur ouvre la fiche puis surligne le texte compris entre « début » et « fin ».
 * Pris en charge par Chrome, Edge et Safari ; Firefox ouvre simplement la page.
 */

const WORDS_PER_SIDE = 5;

/** Encodage d'un morceau de text fragment : les tirets et virgules sont réservés. */
export function encodeFragmentText(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D");
}

/**
 * Texte tel qu'il apparaît sur la page. Nos listes sont stockées « - élément » par
 * ligne, alors que le site affiche des puces : on garde la première ligne sans le tiret.
 */
function visibleText(paragraph: string, position: "first" | "last"): string {
  const lines = paragraph.split("\n").filter((l) => l.trim());
  const line = (position === "first" ? lines[0] : lines[lines.length - 1]) ?? "";
  return line.replace(/^- /, "").replace(/\s+/g, " ").trim();
}

/**
 * Construit le lien vers `url` qui surligne le passage allant du début de
 * `firstParagraph` à la fin de `lastParagraph`.
 */
export function buildHighlightUrl(
  url: string,
  firstParagraph: string,
  lastParagraph: string = firstParagraph,
): string {
  const startWords = visibleText(firstParagraph, "first").split(" ").filter(Boolean);
  const endWords = visibleText(lastParagraph, "last").split(" ").filter(Boolean);
  if (startWords.length === 0) return url;

  const singleShortBlock = firstParagraph === lastParagraph && startWords.length <= WORDS_PER_SIDE * 2;
  if (singleShortBlock) {
    return `${url}:~:text=${encodeFragmentText(startWords.join(" "))}`;
  }
  const start = startWords.slice(0, WORDS_PER_SIDE).join(" ");
  const end = endWords.slice(-WORDS_PER_SIDE).join(" ");
  return `${url}:~:text=${encodeFragmentText(start)},${encodeFragmentText(end)}`;
}
