"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildAnswerMarkdown, type AssistantChatMessage } from "@/lib/chat/assistant-message";
import { SourcesList } from "./SourcesList";

/** Une réponse de l'assistant : texte Markdown, pastilles de citation, sources. */
export function AssistantMessage({ message }: { message: AssistantChatMessage }) {
  const { markdown, refs } = useMemo(() => buildAnswerMarkdown(message.blocks), [message.blocks]);
  const streaming = message.status === "streaming";

  // Les liens « #cite-i » insérés dans le Markdown deviennent des pastilles numérotées
  // qui ouvrent la fiche et surlignent le passage cité.
  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        const match = href?.match(/^#cite-(\d+)$/);
        const ref = match ? refs[Number(match[1])] : undefined;
        if (ref) {
          return (
            <a
              href={ref.citation.highlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="citation-badge"
              title={`${ref.citation.title} : ouvrir et surligner le passage`}
              aria-label={`Source ${ref.number} : ${ref.citation.title}`}
            >
              {ref.number}
            </a>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    }),
    [refs],
  );

  return (
    <div className="flex flex-col gap-3" aria-busy={streaming}>
      {markdown.trim() ? (
        <div className={`answer-prose ${streaming ? "is-streaming" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </div>
      ) : streaming ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
          <span className="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {message.sources.length > 0
            ? `Lecture de ${message.sources.length} passages du guide…`
            : "Recherche dans le guide…"}
        </p>
      ) : null}

      {message.notice ? (
        <p
          role="alert"
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.status === "stopped"
              ? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {message.notice}
        </p>
      ) : null}

      {message.status === "max_tokens" ? (
        <p className="text-sm text-zinc-500">
          Réponse tronquée : posez une question plus précise pour avoir la suite.
        </p>
      ) : null}

      {message.sources.length > 0 ? (
        <SourcesList sources={message.sources} refs={refs} streaming={streaming} />
      ) : null}
    </div>
  );
}
