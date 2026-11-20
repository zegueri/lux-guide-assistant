"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AssistantMessage } from "./AssistantMessage";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { StatusLine } from "./StatusLine";
import { useChat } from "./useChat";

/**
 * Fiche que l'utilisateur lit, passée dans l'URL : /?fiche=frontalier.
 * useSyncExternalStore lit l'URL côté navigateur sans décalage d'hydratation
 * (le rendu serveur voit une chaîne vide).
 */
function useFicheParam(): string | undefined {
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const fiche = new URLSearchParams(search).get("fiche");
  return fiche && /^[a-z0-9_-]{1,60}$/.test(fiche) ? fiche : undefined;
}

export function ChatApp() {
  const fiche = useFicheParam();
  const [ficheDismissed, setFicheDismissed] = useState(false);
  const currentPageId = ficheDismissed ? undefined : fiche;
  const { messages, isStreaming, send, stop, reset } = useChat({ currentPageId });
  const endRef = useRef<HTMLDivElement>(null);

  // Fait défiler jusqu'à la fin à chaque nouveau morceau de réponse.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <main className="flex flex-1 flex-col gap-6 py-6" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState onAsk={send} />
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-white">
                  {message.text}
                </p>
              </div>
            ) : (
              <AssistantMessage key={message.id} message={message} />
            ),
          )
        )}
        <div ref={endRef} />
      </main>

      <div className="sticky bottom-0 flex flex-col gap-2 bg-gradient-to-t from-zinc-50 from-70% pb-4 pt-6 dark:from-zinc-950">
        {currentPageId || messages.length > 0 ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            {currentPageId ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                Fiche en cours de lecture : {currentPageId}
                <button
                  type="button"
                  onClick={() => setFicheDismissed(true)}
                  className="font-semibold hover:text-sky-950 dark:hover:text-white"
                  aria-label="Ne plus privilégier cette fiche"
                >
                  ×
                </button>
              </span>
            ) : (
              <span />
            )}
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Nouvelle conversation
              </button>
            ) : null}
          </div>
        ) : null}
        <Composer onSend={send} onStop={stop} isStreaming={isStreaming} />
        <p className="text-center text-xs text-zinc-500">
          Réponses générées par IA à partir du guide : vérifiez auprès de la source officielle
          avant toute démarche. <StatusLine />
        </p>
      </div>
    </div>
  );
}
