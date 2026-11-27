# FSBM Library

Site statique de consultation des ressources pédagogiques de la Faculté des Sciences Ben M'Sik. Les étudiants naviguent par filière, semestre et module ; chaque module ouvre son dossier Google Drive.

## Gestion du catalogue (sans tableau de bord)

Le catalogue est géré directement dans les fichiers du dépôt GitHub. Il n'y a **ni base de données, ni API, ni compte administrateur nécessaires pour afficher le catalogue public**.

Chaque filière possède son propre dossier et son propre fichier JSON :

```text
src/
└── data/
    └── catalogue/
        ├── informatique-appliquee/
        │   └── catalogue.json
        ├── une-autre-filiere/
        │   └── catalogue.json
        └── ...
```

Astro découvre automatiquement tous les fichiers `src/data/catalogue/*/catalogue.json` lors de la compilation. Pour ajouter une filière, il suffit donc de créer un dossier et un `catalogue.json` : aucun index central ni fichier de code à modifier.

### Structure d'un fichier de filière

Utilisez [`docs/catalogue-template.json`](docs/catalogue-template.json) comme modèle. Chaque fichier contient :
- les informations de la filière (`name`, `slug`, `description`) ;
- un tableau `semesters` ;
- dans chaque semestre, un tableau `modules` ;
- pour chaque module, un unique `driveUrl` qui pointe vers son dossier Google Drive.

Un dossier Drive de module peut contenir ses sous-dossiers `Cours`, `TD`, `TP`, `Examens`, etc. Le site n'héberge pas les documents : il ouvre le dossier Drive.

Exemple de module :

```json
{
  "id": "algorithmique",
  "name": "Algorithmique",
  "code": "INFO101",
  "description": "Cours, TD et examens",
  "driveUrl": "https://drive.google.com/drive/folders/ID_DU_DOSSIER"
}
```

Partagez le dossier Google Drive avec les étudiants selon les droits d'accès souhaités. Vérifiez que le lien ouvre bien le dossier avant de le publier.

### Ajouter ou modifier une filière

1. Dans GitHub, ouvrez `src/data/catalogue/`.
2. Créez un dossier avec un nom court sans espaces, par exemple `genie-informatique`.
3. Ajoutez-y `catalogue.json`, en partant de `docs/catalogue-template.json`.
4. Remplacez les noms, semestres, modules et liens Drive par les vraies informations.
5. Enregistrez/committez le fichier sur `main`. GitHub Actions reconstruit et publie automatiquement le site.

Pour modifier une filière existante, modifiez uniquement son `catalogue.json`. Pour supprimer une filière, supprimez son dossier. Pour retirer un module ou semestre, retirez-le du tableau correspondant.

## Développement local

Prérequis : Node.js 22 et npm.

```sh
npm ci
npm run dev
```

Vérification et compilation :

```sh
npm run check
npm run build
```

Le site est généré en HTML/CSS/JavaScript statique dans `dist/`. Aucun secret ni variable d'API n'est requis pour le catalogue public.

## Publication GitHub Pages

Le workflow `.github/workflows/pages.yml` construit le site et publie `dist` sur GitHub Pages à chaque push sur `main`. Dans les paramètres du dépôt, choisissez **GitHub Actions** comme source de publication Pages.

Le workflow déduit automatiquement le chemin `/nom-du-depot/` pour un dépôt de projet GitHub Pages. Pour ce dépôt, l'URL publique attendue est `https://nv8v.github.io/fsbm-library/`.

## Notes

- Le catalogue fourni contient la filière « Informatique Appliquée » et six semestres vides comme structure de départ. Les modules officiels et leurs liens Drive doivent être ajoutés à partir des informations validées par la faculté ; ils ne sont pas inventés ici.
- Les anciennes sources Worker/Cloudflare sont conservées dans le dépôt comme éléments hérités, mais elles ne sont plus utilisées par le site statique. La route d'administration n'est plus publiée.
- Le pied de page conserve la formule : **وَقُل رَّبِّ زِدْنِي عِلْمًا 🪻**.
