/**
 * Limitation de débit très simple, en mémoire : au plus `limit` requêtes par fenêtre
 * de `windowMs` pour une même clé (l'adresse IP).
 *
 * Limite assumée : sur Vercel, chaque instance a sa propre mémoire, donc la limite est
 * « au mieux ». Pour un vrai service, on utiliserait un stockage partagé (Redis/Upstash).
 * Ici, le but est d'éviter qu'un script vide le budget de la démo publique.
 */
export function createRateLimiter(options: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string, now = Date.now()): { allowed: boolean; retryAfterS: number } {
    // Nettoyage occasionnel pour ne pas faire grossir la Map indéfiniment.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterS: 0 };
    }
    if (entry.count >= options.limit) {
      return { allowed: false, retryAfterS: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true, retryAfterS: 0 };
  };
}

/** Adresse IP du client (Vercel la place dans x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
