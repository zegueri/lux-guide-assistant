import type { CitationRef } from "@/lib/chat/assistant-message";
import type { SourceInfo } from "@/lib/chat/protocol";

interface CitedSource {
  number: number;
  source: SourceInfo;
  /** Lien qui ouvre la fiche et surligne le premier passage cité. */
  href: string;
}

/**
 * Sources d'une réponse : d'abord celles que Claude a citées (numérotées comme les
 * pastilles du texte), puis, repliés, les autres passages consultés.
 */
export function SourcesList({
  sources,
  refs,
  streaming,
}: {
  sources: SourceInfo[];
  refs: CitationRef[];
  streaming: boolean;
}) {
  const cited = new Map<number, CitedSource>();
  for (const ref of refs) {
    const source = sources[ref.citation.sourceIndex];
    if (source && !cited.has(source.index)) {
      cited.set(source.index, { number: ref.number, source, href: ref.citation.highlightUrl });
    }
  }
  const citedList = [...cited.values()].sort((a, b) => a.number - b.number);
  const others = sources.filter((s) => !cited.has(s.index));

  return (
    <section aria-label="Sources" className="flex flex-col gap-2">
      {citedList.length > 0 ? (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sources</h3>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {citedList.map(({ number, source, href }) => (
              <li key={source.id} className="min-w-0">
                <SourceCard source={source} href={href} number={number} />
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {others.length > 0 && !streaming ? (
        <details className="group text-sm">
          <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            {citedList.length > 0
              ? `Autres passages consultés (${others.length})`
              : `Passages consultés (${others.length})`}
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {others.map((source) => (
              <li key={source.id} className="min-w-0">
                <SourceCard source={source} href={source.url} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function SourceCard({ source, href, number }: { source: SourceInfo; href: string; number?: number }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-sky-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-sky-600"
    >
      {number !== undefined ? (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
          {number}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {source.kind === "faq" ? "FAQ" : "Fiche"}
          </span>
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {source.pageTitle}
          </span>
        </span>
        {source.section ? (
          <span className="truncate text-xs text-zinc-500">{source.section}</span>
        ) : null}
        <span className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {source.excerpt}
        </span>
        <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
          {number !== undefined ? "Ouvrir et surligner le passage ↗" : "Ouvrir la page ↗"}
        </span>
      </span>
    </a>
  );
}
