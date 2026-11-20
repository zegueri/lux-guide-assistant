import type {
  ChatEvent,
  CitationInfo,
  HistoryMessage,
  SourceInfo,
  UsageInfo,
} from "./protocol";
import { MAX_HISTORY_MESSAGES } from "./protocol";

/**
 * État d'une conversation côté navigateur, et fonctions pures pour le faire évoluer.
 * Séparées des composants React, elles se testent sans navigateur.
 */

/** Un bloc de texte de la réponse et les citations qui l'appuient. */
export interface TextBlock {
  text: string;
  citations: CitationInfo[];
}

export type AssistantStatus =
  | "streaming"
  | "done"
  | "no_context"
  | "max_tokens"
  | "refusal"
  | "error"
  | "stopped";

export interface UserChatMessage {
  id: string;
  role: "user";
  text: string;
}

export interface AssistantChatMessage {
  id: string;
  role: "assistant";
  blocks: TextBlock[];
  sources: SourceInfo[];
  status: AssistantStatus;
  /** Message à afficher en plus du texte (erreur, refus, interruption). */
  notice?: string;
  usage?: UsageInfo;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage;

export function emptyAssistantMessage(id: string): AssistantChatMessage {
  return { id, role: "assistant", blocks: [], sources: [], status: "streaming" };
}

/** Applique un événement du flux à la réponse en cours (sans la modifier : copie). */
export function applyEvent(message: AssistantChatMessage, event: ChatEvent): AssistantChatMessage {
  const lastBlock = (): TextBlock => message.blocks.at(-1) ?? { text: "", citations: [] };
  const withLastBlock = (block: TextBlock) => [
    ...message.blocks.slice(0, Math.max(0, message.blocks.length - 1)),
    block,
  ];

  switch (event.type) {
    case "sources":
      return { ...message, sources: event.sources };
    case "text-start":
      return { ...message, blocks: [...message.blocks, { text: "", citations: [] }] };
    case "text": {
      const block = lastBlock();
      return { ...message, blocks: withLastBlock({ ...block, text: block.text + event.text }) };
    }
    case "citation": {
      const block = lastBlock();
      return {
        ...message,
        blocks: withLastBlock({ ...block, citations: [...block.citations, event.citation] }),
      };
    }
    case "done":
      return {
        ...message,
        status: event.reason === "complete" ? "done" : event.reason,
        usage: event.usage,
      };
    case "refusal":
      // Réponse partielle jetée : on n'affiche que le message de refus.
      return { ...message, blocks: [], status: "refusal", notice: event.message };
    case "error":
      return { ...message, status: "error", notice: event.message };
  }
}

export function answerText(message: AssistantChatMessage): string {
  return message.blocks.map((b) => b.text).join("");
}

/**
 * Historique renvoyé au serveur : les derniers messages, en texte simple. Les réponses
 * en erreur, refusées ou vides ne sont pas renvoyées.
 */
export function toHistory(messages: ChatMessage[]): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") history.push({ role: "user", content: m.text });
    else if (["done", "max_tokens", "stopped"].includes(m.status) && answerText(m).trim()) {
      history.push({ role: "assistant", content: answerText(m) });
    }
  }
  return history.slice(-MAX_HISTORY_MESSAGES);
}

/** Une citation affichée : son numéro (celui de la source) et la citation elle-même. */
export interface CitationRef {
  number: number;
  citation: CitationInfo;
}

/**
 * Construit le Markdown affiché : le texte de chaque bloc, suivi de liens « [n](#cite-i) »
 * pour ses citations. Les sources sont numérotées dans l'ordre de leur première citation ;
 * le composant de rendu transforme ces liens en pastilles cliquables.
 */
export function buildAnswerMarkdown(blocks: TextBlock[]): {
  markdown: string;
  refs: CitationRef[];
} {
  const numberBySource = new Map<number, number>();
  const refs: CitationRef[] = [];
  let markdown = "";

  for (const block of blocks) {
    if (block.citations.length === 0) {
      markdown += block.text;
      continue;
    }
    const markers: string[] = [];
    const numbersInBlock = new Set<number>();
    for (const citation of block.citations) {
      if (!numberBySource.has(citation.sourceIndex)) {
        numberBySource.set(citation.sourceIndex, numberBySource.size + 1);
      }
      const number = numberBySource.get(citation.sourceIndex)!;
      if (numbersInBlock.has(number)) continue; // une pastille par source et par bloc
      numbersInBlock.add(number);
      refs.push({ number, citation });
      markers.push(`[${number}](#cite-${refs.length - 1})`);
    }
    // Les pastilles se placent avant les espaces et retours à la ligne de fin de bloc.
    const trailing = block.text.match(/\s*$/)?.[0] ?? "";
    const body = block.text.slice(0, block.text.length - trailing.length);
    markdown += `${body} ${markers.join(" ")}${trailing}`;
  }
  return { markdown, refs };
}
