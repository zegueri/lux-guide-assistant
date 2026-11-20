/** Exemples de questions, par thème : un clic pose la question. */
const EXAMPLES: Array<{ theme: string; question: string }> = [
  { theme: "Démarches", question: "Que dois-je faire dans les huit jours après mon arrivée ?" },
  { theme: "Frontaliers", question: "Combien de jours de télétravail pour un frontalier ?" },
  { theme: "Logement", question: "Quelle garantie locative un propriétaire peut-il demander ?" },
  { theme: "Impôts", question: "Comment fonctionnent les classes d'impôt ?" },
  { theme: "Transports", question: "Les transports publics sont-ils vraiment gratuits ?" },
  { theme: "Santé", question: "Ai-je besoin d'une complémentaire santé ?" },
];

export function EmptyState({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <div className="flex flex-col gap-8 py-6 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Une question sur l&apos;installation au Luxembourg ?
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          L&apos;assistant répond à partir des fiches du guide{" "}
          <a
            href="https://lux-guide.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
          >
            lux-guide.github.io
          </a>
          , cite chaque passage utilisé et dit quand le guide ne couvre pas la question.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Exemples de questions
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map(({ theme, question }) => (
            <li key={question}>
              <button
                type="button"
                onClick={() => onAsk(question)}
                className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-sky-400 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-sky-600"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                  {theme}
                </span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{question}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
