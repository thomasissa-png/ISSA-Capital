# Archive — Secrétariat IA S4 (stack WhatsApp + Craft, jamais implémentée)

> Archivé en S17 (2026-05-19) suite à l'audit @ia.
> Référence : `docs/ia/anya-audit-s16.md` — section **W3** (Top 3 faiblesses).

## Pourquoi cette archive

Les fichiers ci-dessous ont été produits en **Session 4 (2026-04-08)** comme spécifications techniques d'un agent secrétariat IA pour ISSA Capital. Ils décrivent une stack **jamais implémentée** : WhatsApp Cloud API Meta, Craft.do, SQLite + SQLCipher, RFC 3161 Universign, RBAC multi-utilisateurs (Carl/Maxime).

La stack qui tourne réellement en production (depuis S9, 2026-04-09) est **complètement différente** :

| | Spec S4 (obsolète) | Stack live S16 |
|---|---|---|
| Interface | WhatsApp Cloud API Meta | Telegram Bot API |
| Stockage CR | Craft.do (API) | Google Drive (vault Obsidian) |
| Base de données | SQLite + SQLCipher (volume Replit) | FS Replit (JSON) + vault Drive |
| STT vocaux | Non spécifié | OpenAI Whisper |
| Utilisateurs | Multi-user (Thomas + Carl + Maxime, RBAC) | Mono-user Thomas |
| Horodatage | RFC 3161 via Universign | Aucun (PATCH in-place vault Drive) |
| Backend | Express sur Replit Pro Autoscale | Next.js App Router |

**Décision S17** : ces 3 fichiers (~1620 lignes) polluent `docs/ia/`. Un futur agent (ou Claude lui-même) qui les lit pour comprendre Anya part dans une mauvaise direction. Le coût tokens à chaque session > zéro valeur d'archive in-place.

## Source de vérité actuelle

Voir `docs/ia/anya-current-architecture.md` (créé S17) qui décrit la stack réelle S16.

## Fichiers archivés

| Fichier | Lignes | Résumé du contenu obsolète |
|---|---|---|
| `secretariat-architecture.md` | 920+ | Architecture complète V1 : WhatsApp Cloud API webhook, schéma SQLite 7 tables (sessions, messages, drafts, cr_documents, contacts, audit_log, users), endpoints Express REST `/api/whatsapp`, publication Craft API, admin web `issa-capital.com/admin`, RBAC Carl/Maxime sur GO+VI+VV. |
| `secretariat-system-prompt.md` | 700+ | System prompt Anthropic Messages avec contraintes @legal (15 formules, 12 anti-formules, registre passé composé), JSON strict + retry self-correction, cache_control ephemeral sur system + contacts DB, modèle `claude-sonnet-4-20250514` avec auto-update. |
| `secretariat-implementation-plan.md` | 360+ | Plan d'exécution V1 en 8 phases séquencées par dépendances : setup Replit + SQLite, intégration WhatsApp Cloud API, prompt Claude, génération PDF + horodatage Universign, publication Craft, admin web, tests E2E. |

## Pourquoi ne pas supprimer

L'historique git garde tout. On archive pour : (a) trace de décision (S4 → pivot S9), (b) éviter un futur "tiens, pourquoi pas WhatsApp/Craft ?" sans contexte, (c) référence si un jour on rebranche une intégration Craft ou WhatsApp pour un autre projet.

**Ne pas relire pour comprendre Anya.** Pour ça : `docs/ia/anya-current-architecture.md`.
