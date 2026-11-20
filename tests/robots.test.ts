import { describe, expect, it } from "vitest";
import { fetchRobotsPolicy, policyFromResponse } from "@/lib/crawler/robots";

const UA = "LuxGuideAssistantBot/0.1";
const ROBOTS_URL = "https://example.org/robots.txt";

describe("policyFromResponse (RFC 9309)", () => {
  it("applique les règles d'un robots.txt présent", () => {
    const body = ["User-agent: *", "Disallow: /prive/", "Crawl-delay: 2"].join("\n");
    const policy = policyFromResponse(ROBOTS_URL, 200, body, UA);
    expect(policy.isAllowed("https://example.org/")).toBe(true);
    expect(policy.isAllowed("https://example.org/prive/page")).toBe(false);
    expect(policy.crawlDelaySeconds).toBe(2);
  });

  it("respecte une règle propre à notre User-Agent", () => {
    const body = ["User-agent: LuxGuideAssistantBot", "Disallow: /"].join("\n");
    expect(policyFromResponse(ROBOTS_URL, 200, body, UA).isAllowed("https://example.org/")).toBe(
      false,
    );
  });

  it("refuse les URL d'un autre domaine", () => {
    const policy = policyFromResponse(ROBOTS_URL, 200, "User-agent: *\nAllow: /", UA);
    expect(policy.isAllowed("https://autre-site.org/")).toBe(false);
  });

  it("autorise tout quand le fichier est absent (404)", () => {
    expect(policyFromResponse(ROBOTS_URL, 404, "", UA).isAllowed("https://example.org/x")).toBe(
      true,
    );
  });

  it("interdit tout en cas d'erreur serveur (5xx)", () => {
    expect(policyFromResponse(ROBOTS_URL, 503, "", UA).isAllowed("https://example.org/")).toBe(
      false,
    );
  });
});

describe("fetchRobotsPolicy", () => {
  it("interdit tout si le réseau échoue", async () => {
    const failingFetch = (() => Promise.reject(new Error("réseau coupé"))) as typeof fetch;
    const policy = await fetchRobotsPolicy("https://example.org", UA, failingFetch);
    expect(policy.isAllowed("https://example.org/")).toBe(false);
  });

  it("envoie notre User-Agent", async () => {
    let sentUserAgent: string | null = null;
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sentUserAgent = new Headers(init?.headers).get("User-Agent");
      return new Response("User-agent: *\nAllow: /", { status: 200 });
    }) as typeof fetch;
    await fetchRobotsPolicy("https://example.org", UA, fakeFetch);
    expect(sentUserAgent).toBe(UA);
  });
});
