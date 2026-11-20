import robotsParser from "robots-parser";

export interface RobotsPolicy {
  /** Le crawler a-t-il le droit de visiter cette URL ? */
  isAllowed(url: string): boolean;
  /** Délai demandé entre deux requêtes (directive non standard Crawl-delay), en secondes. */
  crawlDelaySeconds: number | undefined;
  /** D'où vient la décision, pour l'afficher dans les journaux. */
  source: "robots.txt" | "absent (4xx) : tout est autorisé" | "erreur serveur : tout est interdit";
}

/**
 * Transforme la réponse HTTP de /robots.txt en politique d'exploration (RFC 9309) :
 * - 2xx : on applique les règles du fichier ;
 * - 4xx (le fichier n'existe pas) : aucune restriction ;
 * - 5xx ou erreur réseau : on ne sait pas, donc on s'interdit tout par prudence.
 */
export function policyFromResponse(
  robotsUrl: string,
  status: number,
  body: string,
  userAgent: string,
): RobotsPolicy {
  if (status >= 200 && status < 300) {
    const robots = robotsParser(robotsUrl, body);
    return {
      // isAllowed renvoie undefined pour une URL d'un autre domaine : on refuse.
      isAllowed: (url) => robots.isAllowed(url, userAgent) === true,
      crawlDelaySeconds: robots.getCrawlDelay(userAgent),
      source: "robots.txt",
    };
  }
  if (status >= 400 && status < 500) {
    return {
      isAllowed: () => true,
      crawlDelaySeconds: undefined,
      source: "absent (4xx) : tout est autorisé",
    };
  }
  return {
    isAllowed: () => false,
    crawlDelaySeconds: undefined,
    source: "erreur serveur : tout est interdit",
  };
}

/** Télécharge et interprète le robots.txt d'un site. */
export async function fetchRobotsPolicy(
  origin: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsPolicy> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    const response = await fetchImpl(robotsUrl, { headers: { "User-Agent": userAgent } });
    return policyFromResponse(robotsUrl, response.status, await response.text(), userAgent);
  } catch {
    return policyFromResponse(robotsUrl, 503, "", userAgent);
  }
}
