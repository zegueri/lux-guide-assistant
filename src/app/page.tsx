// Page provisoire de la phase 0 : elle sera remplacée par l'interface de chat (phase 3).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Lux-Guide Assistant</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Posez vos questions sur l&apos;installation et le travail au Luxembourg :
        logement, frontaliers, impôts, transports, démarches. Les réponses viennent
        uniquement du guide lux-guide, avec leurs sources.
      </p>
      <p className="text-sm text-zinc-500">Phase 0 : projet initialisé.</p>
    </main>
  );
}
