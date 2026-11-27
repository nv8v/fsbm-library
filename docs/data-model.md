# Modèle de données du catalogue

Le catalogue public est composé de fichiers JSON, un par filière. Il n'utilise pas Cloudflare D1.

## Emplacement

```text
src/data/catalogue/
├── informatique-appliquee/
│   └── catalogue.json
└── <slug-autre-filiere>/
    └── catalogue.json
```

Chaque fichier décrit une filière et contient ses semestres. Chaque semestre contient ses modules.

## Champs

- Filière : `id` (facultatif), `name`, `slug`, `description` (facultatif), `imageUrl` (facultatif), `semesters`.
- Semestre : `id` (facultatif), `number`, `label` (facultatif), `description` (facultatif), `imageUrl` (facultatif), `modules`.
- Module : `id` (facultatif), `name`, `code` (facultatif), `description` (facultatif), `imageUrl` (facultatif), `driveUrl`.

`driveUrl` est le lien HTTPS unique vers le dossier Google Drive du module. Le dossier Drive peut contenir les sous-dossiers Cours, TD, TP, Examens, etc. Le site ne stocke pas les documents eux-mêmes.

## Validation au build

Le build vérifie les informations obligatoires de la filière et des semestres. Pour chaque module, il exige un nom et une URL HTTPS sur `drive.google.com` contenant un chemin `/folders/<id>`. Un lien manquant ou invalide fait échouer le build au lieu de publier un module sans destination.

Le modèle complet est disponible dans [`catalogue-template.json`](catalogue-template.json).
