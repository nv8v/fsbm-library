# État des vérifications — catalogue statique

## Réalisé sur cette archive

- Le ZIP source a été extrait et la structure du projet inspectée.
- La page d'accueil a été convertie pour charger automatiquement les fichiers `src/data/catalogue/*/catalogue.json` à la compilation.
- Le catalogue de départ contient une filière « Informatique Appliquée » avec six semestres vides. Aucun module officiel ni lien Drive n'a été inventé.
- Le JSON du catalogue de départ a été analysé avec succès.
- La navigation filière → semestre → module et la recherche globale sont locales ; aucun appel à l'API n'est effectué par le site public.
- Les liens des modules sont contrôlés au build : HTTPS, hôte `drive.google.com` et chemin de dossier `/folders/<id>`.
- La route d'administration n'est plus publiée. Les anciens fichiers Worker/D1 restent dans le dépôt mais ne sont pas utilisés par le workflow Pages.
- Le thème, les logos, le style responsive, le lien GitHub et la formule du pied de page ont été conservés.

## Non vérifié dans cet environnement

- `npm ci` n'a pas pu terminer : l'accès au registre npm a expiré, puis le mode hors ligne a signalé un paquet absent du cache.
- L'environnement de travail utilise Node 22.16.0, inférieur à la version minimale demandée par Astro 7.4.13 (Node 22.23.4). Le build Astro et `astro check` n'ont donc pas pu être exécutés ici.

Avant publication, utiliser Node 22.23.4 ou plus récent dans la branche 22, puis exécuter :

```sh
npm ci
npm run build
```

Le workflow GitHub Actions exécute automatiquement ces étapes avant de publier `dist`.
