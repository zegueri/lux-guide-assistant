import { chromium, type Page } from "@playwright/test";
import { z } from "zod";
import { CRAWLER_USER_AGENT, SITE_ORIGIN } from "@/lib/constants";
import { parseFaqHtml, parseFicheHtml } from "./parse";
import { fetchRobotsPolicy } from "./robots";
import type { GuidePage } from "./types";

/**
 * Crawler du site lux-guide.
 *
 * Le site est une application à page unique : le texte des fiches est construit en
 * JavaScript et affiché selon l'ancre de l'URL (#fiche/frontalier). On ouvre donc le
 * site dans Chromium sans interface (Playwright), on charge la page UNE fois, puis on
 * affiche chaque fiche en changeant l'ancre : le site ne refait pas de requête réseau.
 */

export interface CrawlOptions {
  origin?: string;
  /** Pause entre deux fiches, en millisecondes (politesse). */
  delayMs?: number;
  /** Limiter le nombre de fiches (utile pour un essai rapide). */
  limit?: number;
  log?: (message: string) => void;
}

const ficheIdsSchema = z.array(z.string().regex(/^[a-z0-9_-]+$/));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function crawlGuide(options: CrawlOptions = {}): Promise<GuidePage[]> {
  const origin = options.origin ?? SITE_ORIGIN;
  const log = options.log ?? (() => {});
  const home = `${origin}/`;

  // 1. robots.txt d'abord : on ne visite rien de ce qu'il interdit.
  const robots = await fetchRobotsPolicy(origin, CRAWLER_USER_AGENT);
  log(`robots.txt : ${robots.source}`);
  if (!robots.isAllowed(home)) {
    throw new Error(`robots.txt interdit l'exploration de ${home} : arrêt.`);
  }
  const delayMs = Math.max(options.delayMs ?? 1000, (robots.crawlDelaySeconds ?? 0) * 1000);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: CRAWLER_USER_AGENT, locale: "fr-FR" });
    // Ni images, ni polices, ni vidéos : seul le texte nous intéresse (moins de charge pour le site).
    await context.route("**/*", (route) =>
      ["image", "font", "media"].includes(route.request().resourceType())
        ? route.abort()
        : route.continue(),
    );
    const page = await context.newPage();
    await page.goto(home, { waitUntil: "networkidle" });

    // 2. La liste des fiches : le site expose son catalogue dans window.KB.
    //    (On passe le code en texte : Playwright l'exécute tel quel dans la page.)
    const ids = [
      ...new Set(
        ficheIdsSchema.parse(await page.evaluate("(window.KB?.fiches ?? []).map((f) => f.id)")),
      ),
    ].slice(0, options.limit);
    log(`${ids.length} fiches trouvées`);

    // 3. Chaque fiche, une par une, avec une pause entre deux.
    const pages: GuidePage[] = [];
    for (const [index, id] of ids.entries()) {
      const html = await showFiche(page, id);
      pages.push(parseFicheHtml(html, { pageId: id, url: `${origin}/#fiche/${id}` }));
      log(`[${index + 1}/${ids.length}] ${id}`);
      await sleep(delayMs);
    }

    // 4. La FAQ : une liste de questions-réponses, chacune reliée à une fiche.
    await page.evaluate(`location.hash = "#faq"`);
    await page.waitForSelector("#faq-liste details.faq-item", { state: "attached" });
    const faqHtml = await page.locator("#faq-liste").innerHTML();
    const ficheIdByTitle = new Map(pages.map((p) => [p.title, p.pageId]));
    const faq = parseFaqHtml(faqHtml, { url: `${origin}/#faq`, ficheIdByTitle });
    log(`${faq.length} questions de FAQ`);

    return [...pages, ...faq];
  } finally {
    await browser.close();
  }
}

/** Affiche une fiche en changeant l'ancre, attend son rendu et renvoie son HTML. */
async function showFiche(page: Page, id: string): Promise<string> {
  const titleLocator = page.locator("#fiche-detail .detail-hero h1");
  const previousTitle = (await titleLocator.count()) > 0 ? await titleLocator.innerText() : "";

  await page.evaluate(`location.hash = ${JSON.stringify(`#fiche/${id}`)}`);
  // On attend que le titre affiché change : la nouvelle fiche est rendue.
  await page.waitForFunction(
    `(() => {
      const h1 = document.querySelector("#fiche-detail .detail-hero h1");
      return !!h1 && h1.textContent.trim() !== "" && h1.textContent !== ${JSON.stringify(previousTitle)};
    })()`,
  );
  return page.locator("#fiche-detail").innerHTML();
}
