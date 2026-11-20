"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/chat/protocol";

/** Zone de saisie : Entrée envoie, Maj+Entrée va à la ligne. */
export function Composer({
  onSend,
  onStop,
  isStreaming,
}: {
  onSend: (question: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length >= 2 && !isStreaming;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing : ne pas envoyer pendant la saisie d'un caractère composé (accents, IME).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <label htmlFor="question" className="sr-only">
        Votre question
      </label>
      <textarea
        id="question"
        name="question"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={MAX_QUESTION_CHARS}
        rows={1}
        placeholder="Posez votre question sur la vie au Luxembourg…"
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none [field-sizing:content] placeholder:text-zinc-400"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="h-10 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Arrêter
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          className="h-10 shrink-0 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
        >
          Envoyer
        </button>
      )}
    </form>
  );
}
