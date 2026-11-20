import fs from "node:fs";
import path from "node:path";

/**
 * Accès à la base, avec deux implémentations derrière la même interface :
 * - Postgres (Neon, Supabase...) via le client `pg`, quand DATABASE_URL est défini ;
 * - PGlite sinon : le vrai Postgres compilé en WebAssembly, avec pgvector, qui tourne
 *   dans le processus Node (fichier .data/pglite). Aucun service à installer.
 * Les deux exposent `query(sql, params)`, donc le reste du code ne voit pas la différence.
 */

export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  readonly kind: "postgres" | "pglite";
  /** Exécute `fn` dans une transaction : tout est validé, ou rien. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Valeur spéciale de DATABASE_URL : PGlite en mémoire (tests). */
export const PGLITE_IN_MEMORY = "pglite://memory";

export async function createDb(databaseUrl?: string): Promise<Db> {
  if (databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl)) {
    return createPostgresDb(databaseUrl);
  }
  if (databaseUrl && databaseUrl !== PGLITE_IN_MEMORY) {
    throw new Error("DATABASE_URL doit commencer par postgres:// ou postgresql://.");
  }
  const dataDir =
    databaseUrl === PGLITE_IN_MEMORY ? undefined : path.join(process.cwd(), ".data", "pglite");
  return createPgliteDb(dataDir);
}

async function createPostgresDb(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  // Petit pool : en serverless, chaque instance ouvre peu de connexions
  // (le « pooler » de Neon mutualise ensuite côté serveur).
  const pool = new Pool({ connectionString, max: 3 });
  return {
    kind: "postgres",
    async query<T>(sql: string, params?: unknown[]) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      // Une transaction doit rester sur la même connexion du pool.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          async query<R>(sql: string, params?: unknown[]) {
            const r = await client.query(sql, params);
            return { rows: r.rows as R[] };
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createPgliteDb(dataDir: string | undefined): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = dataDir
    ? await PGlite.create(dataDir, { extensions: { vector } })
    : await PGlite.create({ extensions: { vector } });
  return {
    kind: "pglite",
    async query<T>(sql: string, params?: unknown[]) {
      const result = await db.query<T>(sql, params);
      return { rows: result.rows };
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      return db.transaction((tx) =>
        fn({
          async query<R>(sql: string, params?: unknown[]) {
            const r = await tx.query<R>(sql, params);
            return { rows: r.rows };
          },
        }),
      );
    },
    close: () => db.close(),
  };
}

/**
 * Connexion partagée par le serveur Next.js. On la range sur `globalThis` pour que le
 * rechargement à chaud (en développement) ne crée pas une nouvelle connexion à chaque
 * modification de fichier.
 */
const globalForDb = globalThis as typeof globalThis & { __luxGuideDb?: Promise<Db> };

export function getSharedDb(databaseUrl: string | undefined): Promise<Db> {
  globalForDb.__luxGuideDb ??= createDb(databaseUrl).catch((error: unknown) => {
    globalForDb.__luxGuideDb = undefined;
    throw error;
  });
  return globalForDb.__luxGuideDb;
}
