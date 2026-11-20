# Résultats de l'évaluation de la recherche

Généré par `npm run eval` le 2026-11-20.
Modèle d'embeddings : `local:Xenova/multilingual-e5-small` · 196 morceaux (taille max 1200 caractères).

## Métriques

| Métrique | Valeur |
|---|---|
| hit@1 | 95 % |
| hit@3 | 100 % |
| hit@5 | 100 % |
| MRR | 0.975 |
| Questions du guide au-dessus du seuil (0.845) | 100 % |
| Questions hors sujet rejetées | 100 % |
| Latence moyenne embedding + recherche | 7 ms |

Similarité du meilleur passage : la plus faible pour une question du guide est 0.856,
la plus forte pour une question hors sujet est 0.842.

## Détail

| Id | Thème | Question | Fiche attendue | Résultat | Similarité max |
|---|---|---|---|---|---|
| q01 | Démarches | Combien de temps ai-je pour déclarer mon arrivée à la commune ? | arrivee | rang 1 ✓ | 0.918 |
| q02 | Santé | Est-ce que je dois avancer l'argent quand je vais chez le médecin ? | matricule, sante_pratique | rang 2 | 0.856 |
| q03 | Santé | Qu'est-ce que le délai de carence d'une mutuelle santé ? | assurance_sante | rang 1 ✓ | 0.885 |
| q04 | Démarches | Comment obtenir un certificat LuxTrust sans payer trop cher ? | luxtrust | rang 1 ✓ | 0.893 |
| q05 | Logement | Quels papiers préparer avant de visiter un appartement à louer ? | recherche_logement | rang 1 ✓ | 0.864 |
| q06 | Logement | Je n'ai pas de voiture : comment choisir dans quelle commune habiter ? | choisir_commune | rang 1 ✓ | 0.875 |
| q07 | Frontaliers | Si j'habite en France, dans quel pays mon salaire luxembourgeois est-il imposé ? | frontalier | rang 1 ✓ | 0.919 |
| q08 | Logement | Comment être sûr de récupérer ma caution à la fin de la location ? | bail | rang 1 ✓ | 0.868 |
| q09 | Logement | Peut-on avoir une TVA réduite pour l'achat de sa résidence principale ? | achat | rang 1 ✓ | 0.876 |
| q10 | Impôts | Quelle classe d'impôt s'applique quand les deux conjoints travaillent ? | impots_classes | rang 1 ✓ | 0.898 |
| q11 | Impôts | Quelles dépenses puis-je déduire de mes revenus imposables ? | deductions | rang 1 ✓ | 0.870 |
| q12 | Impôts | À quoi sert un contrat de prévoyance-vieillesse 111bis ? | conseil_fiscal | rang 1 ✓ | 0.890 |
| q13 | Impôts | Qui peut profiter du régime fiscal des impatriés ? | impatries | rang 1 ✓ | 0.889 |
| q14 | Impôts | Les intérêts de mon crédit immobilier sont-ils déductibles ? | interets | rang 1 ✓ | 0.912 |
| q15 | Travail | Comment fonctionne l'indexation automatique des salaires ? | cout_vie | rang 1 ✓ | 0.900 |
| q16 | Famille | Comment inscrire mon enfant à l'école publique luxembourgeoise ? | ecole | rang 1 ✓ | 0.891 |
| q17 | Famille | À quoi sert le chèque-service accueil pour la crèche ? | garde | rang 1 ✓ | 0.919 |
| q18 | Transports | Dois-je échanger mon permis de conduire européen ? | permis | rang 1 ✓ | 0.904 |
| q19 | Transports | Le train est-il gratuit même en première classe ? | transport | rang 1 ✓ | 0.898 |
| q20 | Démarches | Combien d'années faut-il pour obtenir la nationalité luxembourgeoise ? | nationalite | rang 1 ✓ | 0.917 |
| h01 | Hors sujet | Quelle est la capitale de l'Australie ? | — | rejetée ✓ | 0.788 |
| h02 | Hors sujet | Donne-moi une recette de tarte aux pommes. | — | rejetée ✓ | 0.807 |
| h03 | Hors sujet | Qui a gagné la Coupe du monde de football en 2018 ? | — | rejetée ✓ | 0.773 |
| h04 | Hors sujet | Comment écrire une boucle for en Python ? | — | rejetée ✓ | 0.817 |
| h05 | Hors sujet | Quel temps fera-t-il demain ? | — | rejetée ✓ | 0.835 |
| h06 | Hors sujet | Comment obtenir un visa pour travailler au Japon ? | — | rejetée ✓ | 0.842 |
