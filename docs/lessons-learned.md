# Lessons Learned — ISSA Capital

> Format v2 (11 colonnes). P0/P1 propagés avant clôture. Entrées archivées dans docs/lessons-learned-archive.md.

## Session 2026-04-07 — Cadrage initial (P0 garde-fous)

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| Cadrage | 2026-04-07 | préférence fondateur | P0 | **Mission vs Valeurs** — Mission = intérêts famille + transmission. Valeurs = filtres, pas finalité. | project-context.md mis à jour, hiérarchie verrouillée | Séparer Mission/Valeurs/Promesse explicitement dans brand-platform | agents + founder-prefs | creative-strategy.md, founder-preferences.md | fait | propagé |
| Cadrage | 2026-04-07 | préférence fondateur | P0 | **Identité libanaise** — SAS française MAIS famille LIBANAISE. Ne jamais écrire "famille française". | Section "Identité familiale" ajoutée dans project-context.md | Vérification double identité fondateur/société en Phase 0 | agents + founder-prefs | creative-strategy.md, copywriter.md, design.md, founder-preferences.md | fait | propagé |
| Cadrage | 2026-04-07 | préférence fondateur | P0 | **VITRINE PAS CONVERSION** — "On est pas là pour plaire au prospect." | Principe directeur #0 + recalibration gates GP7/GP9/GP10 | Question Phase 0 : "Vitrine ou funnel ?" | agents + founder-prefs | orchestrator.md, creative-strategy.md, copywriter.md, ux.md, growth.md, founder-preferences.md | fait | propagé |
| Cadrage | 2026-04-07 | problème | P0 | **Tagline fausse promesse** "On ne vend pas. On garde." — ISSA DOIT pouvoir vendre. | Régénération taglines + contrainte anti-fausse-promesse | Gate cohérence tagline vs modèle opérationnel | agents | creative-strategy.md, _base-agent-protocol.md | en-cours | propagé |
| Cadrage | 2026-04-07 | insistance | P0 | **Simplicité > Démonstration** — Thomas : "Simple, j'insiste." 3 rappels en 3 sessions. | Règle P0 dans brand-voice.md + audit antithèses | Tests : inversion, antithèse, Thomas hostile | agents + founder-prefs | copywriter.md, creative-strategy.md, _base-agent-protocol.md, founder-preferences.md | fait | propagé |

## Sessions 4-6 — P0/P1 actifs

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| Session 4 | 2026-04-08 | problème | P1 | **Placeholder `[Nom agence]` recopié par @fullstack** — handoff spécifiait substitution V1 | Substitution appliquée (commit ac55d5c) | Lire systématiquement le handoff @copywriter AVANT de copier | agent (@fullstack) | fullstack.md | fait | propagé |
| Session 4 | 2026-04-08 | recommandation | P2 | **Dispersion marqueurs `[NOM]` Carl/Maxime** dans 4 livrables | Centralisation dans contacts-database.md | Ne jamais dupliquer un placeholder — référencer le seed unique | agents (@PM, @ia, @legal) | product-manager.md, ia.md, legal.md | en-cours | propagé |
| Session 5 | 2026-04-08 | problème | P1 | **Sub-orchestrator n'a pas Task** — limitation env sub-sub-agent | Main thread dispatcher pattern | Vérifier Task en début de session | règle-globale | orchestrator.md | fait | propagé |
| Session 5 | 2026-04-08 | problème | P1 | **Duplication après propagation chirurgicale** copy | @fullstack a aligné sur source de vérité | Relire section copy complète, pas juste le bloc modifié | agent (@fullstack) | fullstack.md | fait | propagé |
| Session 5 | 2026-04-08 | requête | P1 | **Favicon "Paint"** — lettres en rectangles, pas Bézier | Refonte Direction A + propagation binaires | Paths Bézier obligatoires pour assets typographiques | agent (@design) | design.md | fait | propagé |
| Session 6 | 2026-04-08 | problème | P1 | **Date 2J 1994→2016** — fait biographique non vérifié, propagé 3 sessions | Correction immédiate + section "Corrections factuelles verrouillées" | Section "Faits biographiques verrouillés" dans project-context.md | règle-globale | CLAUDE.md, copywriter.md, creative-strategy.md | fait | propagé |
| Session 6 | 2026-04-08 | insistance | P2 | **Bio trop longue** — Thomas : "trop de famille", "pas un musée biographique" | Versions MIN/INT/RICHE produites | Volume bio calibré sur valeur persona, pas disponibilité faits | règle-globale | CLAUDE.md, copywriter.md, creative-strategy.md | fait | propagé |
| Session 6 | 2026-04-08 | préférence fondateur | P1 | **Anti-justifications** — "une marque sûre d'elle ne se justifie pas" | Audit 5 occ + 3 reformulations | Détection anti-justification dans copywriter.md | agent + founder-prefs | copywriter.md, founder-preferences.md | fait | propagé |

## Sessions 7-8 — P1 actifs

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| Session 7-8 | 2026-04-09 | pattern | P1 | **Mega-passe @fullstack 7 chantiers** en 1 Task — briefer par blocs numérotés | Pattern éprouvé | Blocs numérotés + validation tsc après chaque bloc | aucune | n/a | fait | n/a |
| Session 7-8 | 2026-04-09 | problème | P1 | **Credentials en clair dans .md committé** — clé Craft `pdk_9b7b...` depuis session 4 | Purge + migration .env.local | Ne JAMAIS committer de credentials — .env.local dès la 1ère mention | règle-globale | CLAUDE.md (règle 18), ia.md, legal.md, product-manager.md | fait | propagé |
| Session 7-8 | 2026-04-09 | problème | P2 | **tsconfig capture sous-dossier** — monorepo Next.js + Node séparés | Ajout "secretariat" dans exclude[] | Exclure l'autre projet du tsconfig racine | règle-globale | fullstack.md, infrastructure.md | fait | propagé |

## Session 9 — P0/P1/P2 actifs

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| Session 9 | 2026-04-09 | insistance | P0 | **Zéro MVP** — "Le mot MVP doit être banni. Je veux des trucs finis." | Features brief initial réintégrées dans webhook Telegram | Ne JAMAIS couper du brief initial. Le mot MVP est banni. | règle-globale + agents | CLAUDE.md, fullstack.md, ia.md, infrastructure.md | fait | propagé |
| Session 9 | 2026-04-09 | problème | P1 | **SDK Anthropic peerDep zod ^3.25** casse npm install | .npmrc legacy-peer-deps=true + zod 3.24.4 | Vérifier peerDeps AVANT commit | agent (@fullstack) | .npmrc, package.json | fait | n/a |
| Session 9 | 2026-04-09 | problème | P1 | **Claude JSON dans bloc markdown** — \`\`\`json...\`\`\` casse JSON.parse | Regex nettoyage avant parse | Tout parser Claude doit nettoyer markdown blocks | agent (@ia, @fullstack) | n/a | fait | n/a |
| Session 9 | 2026-04-09 | préférence fondateur | P1 | **"famille libanaise" interdit** (retour Jean-Pierre) — formulations autorisées : "racines libanaises", "d'origine libanaise", "famille Issa" | Code site + project-context.md mis à jour | NE PLUS ÉCRIRE "famille libanaise" | règle-globale | project-context.md, src/app/*.tsx | fait | propagé |
| Session 9 | 2026-04-09 | préférence fondateur | P2 | **Umami uniquement** — jamais Plausible ni GA4 | Plausible retiré partout, Umami intégré | Umami par défaut pour tous projets Thomas | founder-prefs + agent | data-analyst.md, founder-preferences.md | fait | propagé |
| Session 9 | 2026-05-10 | problème | P2 | **Guide technique inutile MCP Gmail/Calendar** — Claude Desktop a une intégration Google native. Claude a fait perdre du temps à Thomas avec installation Node.js + OAuth + config JSON. | Guide supprimé. | **Toujours vérifier les intégrations natives** d'un outil avant de recommander une solution technique complexe. | documentation | n/a | fait | n/a |

## Notes de propagation session 9

- ✅ P0 "Zéro MVP" → propagé fullstack.md, ia.md, infrastructure.md + docs/founder-preferences.md créé
- ✅ P2 "Umami" → propagé data-analyst.md + docs/founder-preferences.md
- ✅ Toutes les entrées P2/P3 propagées des sessions 1-8 archivées dans docs/lessons-learned-archive.md

## Session 10 — 2026-05-10 — Vault Obsidian + alignement contacts

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| Session 10 | 2026-05-10 | préférence fondateur | P2 | **Pas de dichotomie Pro/Perso dans le vault** — Thomas refuse la séparation Pro/Perso pour ses contacts et notes. Un contact reste un contact. Structure validée : containers structurés à plat (Projets, Contacts, Réunions, Tâches) + Notes/ pour le perso thématique (Idées, Learnings, Cuisine, Voyages). | Arbo Alternative C implémentée dans second-cerveau/CLAUDE.md | Pour les vaults personnels : ne pas imposer de dichotomie Pro/Perso — laisser le fondateur organiser selon sa logique mentale. | founder-prefs | docs/founder-preferences.md | fait | propagé |
| Session 10 | 2026-05-10 | problème | P1 | **Vault session 9 livré vide** — 8 dossiers annoncés, 0 créés sur disque (git ne traque pas les dossiers vides) + 0 contenu pré-rempli. Les fiches Projets et Contacts étaient planifiées mais jamais écrites. | Session 10 : 8 fiches Projets + 14 fiches Contacts pré-remplies depuis sources existantes (project-context.md, src/lib/secretariat/contacts.ts, docs/product/secretariat-contacts-database.md). Zéro invention. | Quand on crée une structure de vault/dossiers, toujours inclure au minimum un fichier par dossier (README ou fiche pré-remplie) pour que git traque le dossier ET que l'utilisateur ait un contenu utile dès l'ouverture. | aucune | n/a | fait | n/a |
| Session 10 | 2026-05-10 | problème | P2 | **Conclusion erronée "pas de MCP Craft"** — orchestrator a conclu sans WebFetch/WebSearch que Craft n'avait pas de MCP. Thomas a pointé la page craft.do/imagine/guide/api/api → vérification a révélé que Craft a en fait un MCP officiel (https://mcp.craft.do/my/mcp) sorti récemment. Symétrique au learning session 9 P2 (guide MCP Gmail inutile car intégration native). | SETUP-CRAFT-MCP.md créé. Orchestrator briefé : WebFetch obligatoire avant de conclure "n'existe pas". | **Toujours vérifier la dispo d'une intégration native/MCP via WebSearch+WebFetch** avant de conclure "n'existe pas" ou de recommander une alternative complexe. | règle-globale | CLAUDE.md (règle anti-hallucination intégrations) | fait | non-propagé |
