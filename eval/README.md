# Évaluation de la recherche

`npm run eval` mesure la qualité de la **recherche** (le « R » de RAG), sans appeler le
LLM : c'est gratuit, reproductible, et c'est le maillon décisif. Si le bon passage ne
remonte pas, Claude ne peut pas bien répondre ; s'il remonte, la consigne de répondre
uniquement à partir des passages fait le reste.

## Le jeu de questions

[`questions.json`](questions.json) contient :

- **20 questions du guide**, formulées comme un utilisateur (logement, frontaliers,
  impôts, transports, santé, famille, démarches), chacune avec la ou les fiches attendues ;
- **6 questions hors sujet** (capitale de l'Australie, recette, Python, météo...), dont une
  proche du domaine (« visa pour travailler au Japon »), qui doivent être rejetées.

Un passage de FAQ compte comme correct s'il renvoie à la fiche attendue (bouton
« Voir la fiche » sur le site).

## Les métriques

- **hit@k** : part des questions dont la fiche attendue apparaît dans les k premiers
  passages. hit@5 est le plus important ici : l'API en donne 6 à Claude.
- **MRR** (Mean Reciprocal Rank) : moyenne de 1/rang de la première bonne fiche
  (1 si elle est première, 0,5 si deuxième...). Résume la qualité du classement.
- **Seuil « je ne sais pas »** : part des questions du guide au-dessus du seuil (le LLM
  est appelé) et part des questions hors sujet en dessous (réponse « je ne sais pas »
  sans appel payant).

## Résultats (embeddings locaux `multilingual-e5-small`, morceaux de 1 200 caractères max)

Détail question par question : [`results.md`](results.md).

| Métrique | Valeur |
|---|---|
| hit@1 | 95 % (19/20) |
| hit@3 | 100 % |
| hit@5 | 100 % |
| MRR | 0,975 |
| Questions du guide au-dessus du seuil 0,845 | 100 % |
| Questions hors sujet rejetées | 100 % (6/6) |
| Latence embedding + recherche (local, PGlite) | ~8 ms par question |

### Taille des morceaux

| Taille max | Morceaux | hit@1 | hit@5 | MRR |
|---|---|---|---|---|
| 600 caractères | 247 | 100 % | 100 % | 1,000 |
| **1 200 caractères (retenu)** | 196 | 95 % | 100 % | 0,975 |
| 2 000 caractères | 193 | 100 % | 100 % | 1,000 |

Les trois réglages sont équivalents : un seul écart, sur q02 (deux fiches parlent du
remboursement des soins), et le corpus est fait de sections déjà courtes (425 caractères
en moyenne), que la limite ne coupe presque jamais. Le jeu est trop petit pour
départager ; 1 200 caractères garde une marge sous la limite de 512 tokens du modèle e5
tout en donnant à Claude des passages complets.

### Calibration du seuil

Avec e5, les similarités sont tassées : la plus faible pour une question du guide est
**0,856**, la plus forte pour une question hors sujet est **0,842** (« visa pour le
Japon »). Le seuil a été placé entre les deux, à **0,845**. La marge est faible : le seuil
sert de filet de sécurité pour éviter un appel payant inutile, et la consigne donnée à
Claude (« dis que le guide ne précise pas ») reste la seconde ligne de défense.

## Limites, à dire franchement

- **Petit jeu, écrit par l'auteur** après lecture des titres des fiches : les questions
  partagent souvent du vocabulaire avec le texte, ce qui rend la recherche plus facile
  qu'avec de vrais utilisateurs. Les scores sont donc optimistes.
- **Seuil calibré sur le même jeu** que celui qui le mesure : il faudrait un jeu séparé
  (questions réelles, collectées après mise en ligne) pour une mesure honnête.
- **La rédaction n'est pas évaluée** : fidélité aux sources, citations correctes, refus
  à bon escient. Piste : un jeu de questions-réponses de référence et un « LLM juge »
  (par exemple Claude Haiku) qui vérifie que chaque phrase est appuyée par une citation.
