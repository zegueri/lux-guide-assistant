"use client";

import { useEffect, useState } from "react";

interface Status {
  ready: boolean;
  chunkCount?: number;
  ingestedAt?: string | null;
  llmConfigured?: boolean;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

/** Ligne d'état sous la zone de saisie : taille de l'index, date de mise à jour. */
export function StatusLine() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json() as Promise<Status>)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus({ ready: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  if (!status.ready) {
    return <span>Index indisponible : lancez l&apos;ingestion (npm run ingest).</span>;
  }
  return (
    <span>
      {status.chunkCount} passages indexés
      {status.ingestedAt ? ` · mis à jour le ${dateFormat.format(new Date(status.ingestedAt))}` : ""}
      {status.llmConfigured === false ? " · clé API Claude non configurée" : ""}
    </span>
  );
}
