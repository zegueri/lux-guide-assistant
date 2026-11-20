"use client";

import { useCallback, useRef, useState } from "react";
import {
  applyEvent,
  emptyAssistantMessage,
  toHistory,
  type AssistantChatMessage,
  type ChatMessage,
} from "@/lib/chat/assistant-message";
import { readEvents, type ChatRequest } from "@/lib/chat/protocol";

/**
 * Hook React qui gère la conversation : envoie la question à /api/chat, lit le flux
 * NDJSON et met à jour la réponse au fur et à mesure.
 */
export function useChat(options: { currentPageId?: string } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /** Met à jour la dernière réponse de l'assistant (toujours en copiant, jamais en place). */
  const updateLastAnswer = useCallback(
    (update: (m: AssistantChatMessage) => AssistantChatMessage) => {
      setMessages((previous) => {
        const last = previous.at(-1);
        if (!last || last.role !== "assistant") return previous;
        return [...previous.slice(0, -1), update(last)];
      });
    },
    [],
  );

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (text.length < 2 || isStreaming) return;

      const controller = new AbortController();
      abortRef.current = controller;
      const request: ChatRequest = {
        question: text,
        history: toHistory(messages),
        currentPageId: options.currentPageId,
      };
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: "user", text },
        emptyAssistantMessage(crypto.randomUUID()),
      ]);
      setIsStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          // Erreur avant le streaming (validation, clé absente, limite de débit...).
          const data: unknown = await response.json().catch(() => null);
          const message =
            data && typeof data === "object" && "error" in data && typeof data.error === "string"
              ? data.error
              : `Le serveur a répondu avec une erreur (${response.status}).`;
          updateLastAnswer((m) => applyEvent(m, { type: "error", message }));
          return;
        }
        for await (const event of readEvents(response.body)) {
          updateLastAnswer((m) => applyEvent(m, event));
        }
      } catch {
        if (controller.signal.aborted) {
          updateLastAnswer((m) => ({ ...m, status: "stopped", notice: "Réponse interrompue." }));
        } else {
          updateLastAnswer((m) =>
            applyEvent(m, { type: "error", message: "Connexion au serveur impossible." }),
          );
        }
      } finally {
        // Flux coupé sans événement de fin : on le signale plutôt que de tourner sans fin.
        updateLastAnswer((m) =>
          m.status === "streaming"
            ? { ...m, status: "error", notice: "La réponse a été interrompue." }
            : m,
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, options.currentPageId, updateLastAnswer],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, isStreaming, send, stop, reset };
}
