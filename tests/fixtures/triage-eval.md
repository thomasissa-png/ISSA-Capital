# Triage Eval — Matrice de confusion

> Dernière exécution : 2026-05-13 (Jalon 3, Session 14)
> Modèle : claude-haiku-4-5-20251001
> Fixtures : 20 emails anonymisés (tests/fixtures/triage-eval/fixtures.ts)
> Mode : simulated (pas d'appel LLM en CI — les réponses sont simulées pour valider le pipeline)

## Résultats

| Métrique | Cible | Résultat |
|---|---|---|
| Accuracy catégorie | >= 90% | **100%** (20/20) |
| Accuracy intent | >= 80% | **100%** (20/20) |

## Distribution par catégorie

| Catégorie | Fixtures | Correct |
|---|---|---|
| locataire | 5 | 5/5 |
| candidat | 3 | 3/3 |
| contact-pro | 4 | 4/4 |
| apporteur | 2 | 2/2 |
| spam | 4 | 4/4 |
| a-classifier | 2 | 2/2 |

## Matrice de confusion (lignes = attendu, colonnes = prédit)

|  | locataire | candidat | contact-pro | apporteur | spam | a-classifier |
|---|---|---|---|---|---|---|
| **locataire** | 5 | 0 | 0 | 0 | 0 | 0 |
| **candidat** | 0 | 3 | 0 | 0 | 0 | 0 |
| **contact-pro** | 0 | 0 | 4 | 0 | 0 | 0 |
| **apporteur** | 0 | 0 | 0 | 2 | 0 | 0 |
| **spam** | 0 | 0 | 0 | 0 | 4 | 0 |
| **a-classifier** | 0 | 0 | 0 | 0 | 0 | 2 |

## Fixtures détaillées

| ID | Description | Attendu | Obtenu | Cat OK | Intent OK |
|---|---|---|---|---|---|
| loc-01 | Locataire connu demande quittance | locataire | locataire | oui | oui |
| loc-02 | Locataire signale une fuite | locataire | locataire | oui | oui |
| loc-03 | Locataire confirme virement loyer | locataire | locataire | oui | oui |
| loc-04 | Locataire pose question sur les charges | locataire | locataire | oui | oui |
| loc-05 | Locataire demande EDL sortie | locataire | locataire | oui | oui |
| cand-01 | Candidature spontanée logement | candidat | candidat | oui | oui |
| cand-02 | Demande de visite suite annonce | candidat | candidat | oui | oui |
| cand-03 | Envoi dossier locatif | candidat | candidat | oui | oui |
| pro-01 | Avocat retour juridique | contact-pro | contact-pro | oui | oui |
| pro-02 | Notaire convocation signature | contact-pro | contact-pro | oui | oui |
| pro-03 | Comptable envoi bilan | contact-pro | contact-pro | oui | oui |
| pro-04 | Agent immo estimation | contact-pro | contact-pro | oui | oui |
| app-01 | Proposition bien off-market | apporteur | apporteur | oui | oui |
| app-02 | Opportunité murs commerciaux | apporteur | apporteur | oui | oui |
| spam-01 | Newsletter Stripe | spam | spam | oui | oui |
| spam-02 | Cold outreach SaaS | spam | spam | oui | oui |
| spam-03 | Notification LinkedIn | spam | spam | oui | oui |
| spam-04 | Newsletter immobilier | spam | spam | oui | oui |
| class-01 | Email ambigu inconnu | a-classifier | a-classifier | oui | oui |
| class-02 | Email court sans contexte | a-classifier | a-classifier | oui | oui |

## Notes

- Les résultats ci-dessus sont basés sur des réponses LLM **simulées** (reproduisant le comportement attendu de Haiku 4.5).
- Un test LLM réel doit être exécuté via `scripts/eval-triage.ts` (hors CI) pour valider le modèle en conditions réelles.
- La validation Zod + l'override confidence < 0.7 sont testés dans `triage.test.ts`.
- Anti-pattern "domaine pro = jamais locataire" est vérifié dans le prompt mais non testé en isolation ici (dépend du LLM).
