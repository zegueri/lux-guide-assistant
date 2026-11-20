import Link from "next/link";

const REPO_URL = "https://github.com/zegueri/lux-guide-assistant";

/** En-tête commun : bandeau aux couleurs du drapeau, titre, navigation. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex h-1" aria-hidden="true">
        <span className="flex-1 bg-[#ed2939]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#00a1de]" />
      </div>
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="whitespace-nowrap font-semibold tracking-tight">Lux-Guide Assistant</span>
          <span className="hidden text-xs text-zinc-500 sm:inline">vivre et travailler au Luxembourg</span>
        </Link>
        <nav className="flex items-center gap-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/a-propos" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            <span className="sm:hidden">À propos</span>
            <span className="hidden sm:inline">Comment ça marche</span>
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Code
          </a>
        </nav>
      </div>
    </header>
  );
}
