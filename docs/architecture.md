# Architecture — FSBM Library

## Périmètre

Le site public est un site statique Astro publié sur GitHub Pages. Les étudiants naviguent dans la hiérarchie filière → semestre → module → dossier Google Drive. Aucun compte étudiant, Worker, API ou base de données n'est nécessaire pour consulter le catalogue.

## Composants

- **Astro** découvre les fichiers JSON du catalogue à la compilation et génère le site statique.
- **Fichiers JSON par filière** : chaque filière possède son dossier indépendant sous `src/data/catalogue/<slug>/catalogue.json`.
- **JavaScript navigateur** : navigation dans la hiérarchie et recherche locale dans les données intégrées au site.
- **GitHub Pages / GitHub Actions** : compilation et publication automatiques à chaque push sur `main`.
- **Google Drive** : un dossier partagé par module, pouvant contenir Cours, TD, TP, Examens, etc.

## Flux des données

Au build, Astro charge tous les fichiers `src/data/catalogue/*/catalogue.json`, les trie et les intègre au HTML statique. Le navigateur n'effectue aucune requête vers une API pour afficher ou rechercher les filières, semestres et modules. Chaque module ouvre son propre lien HTTPS de dossier Google Drive dans un nouvel onglet.

## Ajouter une filière

Créer `src/data/catalogue/<slug>/catalogue.json` suffit. Aucun index central ni changement de code n'est nécessaire. Le schéma de départ est documenté dans `docs/catalogue-template.json` et dans le README.

## Éléments hérités

Les sources Cloudflare Worker, D1 et migrations restent dans le dépôt comme archives techniques. Elles ne sont pas utilisées par le site public statique et ne sont pas déployées par le workflow Pages actuel. La route d'administration n'est plus publiée.
