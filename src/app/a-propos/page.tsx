import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Comment ça marche · Lux-Guide Assistant",
  description: "Architecture RAG de Lux-Guide Assistant : crawl, découpage, pgvector, Claude, citations.",
};

const STEPS = [
  {
    title: "1. Le guide est parcouru et découpé",
    text: "Un robot poli (il respecte robots.txt et marque une pause entre chaque page) affiche chaque fiche du site dans un navigateur sans interface, car le site construit son contenu en JavaScript. Chaque fiche est découpée par section : un morceau garde son titre, sa section et l'adresse de la fiche.",
  },
  {
    title: "2. Chaque morceau devient un vecteur",
    text: "Un modèle d'embeddings multilingue transforme chaque morceau en une liste de nombres qui résume son sens. Les vecteurs sont rangés dans Postgres avec l'extension pgvector.",
  },
  {
    title: "3. La question retrouve les passages proches",
    text: "Votre question est vectorisée de la même façon ; Postgres renvoie les six passages dont le sens est le plus proche. Si aucun n'est assez proche, l'assistant répond qu'il ne sait pas, sans appeler le modèle de langage.",
  },
  {
    title: "4. Claude répond en citant ses sources",
    text: "Les passages sont transmis à Claude (Anthropic) comme des résultats de recherche. Claude rédige la réponse en s'appuyant uniquement sur eux et renvoie des citations structurées : chaque pastille numérotée ouvre la fiche et surligne le passage cité.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Comment ça marche</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Lux-Guide Assistant est un assistant de type RAG (génération augmentée par la
          recherche) : il ne répond pas « de mémoire », il cherche d&apos;abord dans le guide{" "}
          <a href="https://lux-guide.github.io" className="text-sky-700 underline dark:text-sky-400">
            lux-guide.github.io
          </a>{" "}
          puis rédige sa réponse à partir des passages trouvés.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.text}</p>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Limites</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>Le guide n&apos;est pas un conseil juridique ou fiscal : la source officielle fait foi.</li>
          <li>L&apos;assistant ne connaît que le contenu du guide au moment de la dernière indexation.</li>
          <li>
            Le surlignage du passage fonctionne dans Chrome, Edge et Safari ; Firefox ouvre la fiche
            sans surligner.
          </li>
        </ul>
      </section>

      <p className="text-sm text-zinc-500">
        Le code, l&apos;architecture détaillée et les résultats de l&apos;évaluation sont sur{" "}
        <a
          href="https://github.com/zegueri/lux-guide-assistant"
          className="text-sky-700 underline dark:text-sky-400"
        >
          GitHub
        </a>
        . <Link href="/" className="text-sky-700 underline dark:text-sky-400">Poser une question</Link>
      </p>
    </main>
  );
}
