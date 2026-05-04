# Claude Profile — Thomas Issa

Ces fichiers décrivent qui est Thomas Issa, comment il travaille, et ce qu'il attend de Claude. Copie-les dans n'importe quel projet pour que Claude te connaisse dès le départ.

## Fichiers

| Fichier | Contenu |
|---|---|
| `about-me.md` | Parcours, réseau, vision, convictions |
| `voice-preferences.md` | Ton de voix, registre, format de réponse attendu |
| `work-preferences.md` | Qualité, décisions, UX, tech, communication |
| `brand-identity.md` | Identité ISSA Capital + Versi + principes transversaux |

## Utilisation

### Dans Claude Code (CLI)

Copie les fichiers dans le dossier `.claude/` de ton projet :

```
cp claude-profile/*.md /mon-projet/.claude/
```

Puis ajoute dans ton `CLAUDE.md` :

```markdown
## Profil fondateur
Lire les fichiers `.claude/about-me.md`, `.claude/voice-preferences.md`, `.claude/work-preferences.md` et `.claude/brand-identity.md` avant toute production.
```

### Dans Claude.ai (web)

Copie le contenu des fichiers dans les "Project Instructions" de ton projet.

## Mise à jour

Ces fichiers sont un snapshot. Les mettre à jour quand :
- Un nouveau projet est lancé (ajouter dans brand-identity)
- Une préférence change (work-preferences)
- Le réseau évolue (about-me)
