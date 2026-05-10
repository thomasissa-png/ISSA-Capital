# Dashboard

## Projets actifs

```dataview
TABLE statut, date_début, associés
FROM "Projets"
WHERE type = "projet" AND statut = "actif"
SORT date_début DESC
```

## Contacts récents

```dataview
TABLE société, rôle, date_dernière_interaction
FROM "Contacts"
WHERE type = "contact"
SORT date_dernière_interaction DESC
LIMIT 10
```

## Tâches en cours

```dataview
TASK
FROM "Tâches"
WHERE !completed
SORT due ASC
```

## Réunions récentes

```dataview
TABLE
FROM "Réunions"
SORT file.name DESC
LIMIT 5
```

## Notes récentes

```dataview
TABLE
FROM "Notes"
SORT file.mtime DESC
LIMIT 5
```
