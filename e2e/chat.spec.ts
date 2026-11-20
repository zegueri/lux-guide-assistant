import { expect, test, type Page } from "@playwright/test";
import type { ChatEvent } from "../src/lib/chat/protocol";

const FICHE = "https://lux-guide.github.io/#fiche/frontalier";
const QUESTION = "Combien de jours de télétravail pour un frontalier ?";

/** Réponse simulée de /api/chat, au format NDJSON réel. */
const ANSWER_EVENTS: ChatEvent[] = [
  {
    type: "sources",
    sources: [
      {
        index: 0,
        id: "frontalier:3",
        url: FICHE,
        pageTitle: "Habiter en France, en Belgique ou en Allemagne",
        section: "Le télétravail a deux plafonds, et ce ne sont pas les mêmes",
        kind: "fiche",
        similarity: 0.85,
        excerpt: "C'est le point qui surprend le plus.",
      },
      {
        index: 1,
        id: "transport:0",
        url: "https://lux-guide.github.io/#fiche/transport",
        pageTitle: "Transports publics gratuits",
        section: "Introduction",
        kind: "fiche",
        similarity: 0.8,
        excerpt: "Bus et trains sont gratuits.",
      },
    ],
  },
  { type: "text-start" },
  { type: "text", text: "Il existe deux plafonds distincts, l'un fiscal et l'autre social." },
  {
    type: "citation",
    citation: {
      sourceIndex: 0,
      url: FICHE,
      title: "Habiter en France — Le télétravail a deux plafonds",
      citedText: "Le premier plafond est fiscal.",
      highlightUrl: `${FICHE}:~:text=Le%20premier%20plafond%20est%20fiscal.`,
    },
  },
  { type: "done", reason: "complete" },
];

const toNdjson = (events: ChatEvent[]) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";

async function mockStatus(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { ready: true, chunkCount: 196, ingestedAt: "2026-11-20T10:00:00.000Z", llmConfigured: true },
    }),
  );
}

test("poser une question affiche la réponse, ses citations et ses sources", async ({ page }) => {
  await mockStatus(page);
  let sentBody: unknown;
  await page.route("**/api/chat", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/x-ndjson", body: toNdjson(ANSWER_EVENTS) });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /installation au Luxembourg/ })).toBeVisible();

  await page.getByLabel("Votre question").fill(QUESTION);
  await page.getByRole("button", { name: "Envoyer" }).click();

  // La question et la réponse s'affichent.
  await expect(page.getByText(QUESTION)).toBeVisible();
  await expect(page.getByText("Il existe deux plafonds distincts")).toBeVisible();

  // La pastille de citation ouvre la fiche et surligne le passage (text fragment).
  const badge = page.getByRole("link", { name: /^Source 1/ });
  await expect(badge).toHaveText("1");
  await expect(badge).toHaveAttribute("href", `${FICHE}:~:text=Le%20premier%20plafond%20est%20fiscal.`);
  await expect(badge).toHaveAttribute("target", "_blank");

  // La carte de la source citée est visible ; le passage non cité est replié.
  const sources = page.getByRole("region", { name: "Sources" });
  await expect(sources.getByText("Habiter en France, en Belgique ou en Allemagne")).toBeVisible();
  await expect(sources.getByText("Autres passages consultés (1)")).toBeVisible();
  await expect(sources.getByText("Transports publics gratuits")).toBeHidden();

  // La requête envoyée respecte le protocole.
  expect(sentBody).toMatchObject({ question: QUESTION, history: [] });
});

test("un clic sur un exemple pose la question", async ({ page }) => {
  await mockStatus(page);
  await page.route("**/api/chat", (route) =>
    route.fulfill({ contentType: "application/x-ndjson", body: toNdjson(ANSWER_EVENTS) }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Combien de jours de télétravail/ }).click();
  await expect(page.getByText("Il existe deux plafonds distincts")).toBeVisible();
});

test("hors du guide : l'assistant dit qu'il ne sait pas, sans source", async ({ page }) => {
  await mockStatus(page);
  const noContext: ChatEvent[] = [
    { type: "sources", sources: [] },
    { type: "text-start" },
    { type: "text", text: "Je ne trouve pas cette information dans le guide lux-guide." },
    { type: "done", reason: "no_context" },
  ];
  await page.route("**/api/chat", (route) =>
    route.fulfill({ contentType: "application/x-ndjson", body: toNdjson(noContext) }),
  );
  await page.goto("/");
  await page.getByLabel("Votre question").fill("Quelle est la capitale de l'Australie ?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Je ne trouve pas cette information dans le guide")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sources" })).toHaveCount(0);
});

test("une erreur du serveur est expliquée à l'utilisateur", async ({ page }) => {
  await mockStatus(page);
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 429, json: { error: "Trop de questions d'affilée : réessayez dans une minute." } }),
  );
  await page.goto("/");
  await page.getByLabel("Votre question").fill(QUESTION);
  await page.getByRole("button", { name: "Envoyer" }).click();
  // On cherche l'alerte dans la zone principale (Next.js ajoute son propre role="alert").
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Trop de questions d'affilée : réessayez dans une minute.",
  );
});
