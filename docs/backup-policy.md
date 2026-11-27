# Politique de sauvegarde

## Sources à sauvegarder

1. **Dépôt GitHub** : source du site et fichiers JSON du catalogue. Git conserve l'historique des modifications ; conserver également une archive ZIP périodique du dépôt.
2. **Google Drive** : emplacement primaire des documents académiques. Les dossiers pédagogiques doivent être sauvegardés indépendamment du dépôt Git.
3. **Copie locale ou hors site** : conserver une copie des dossiers Drive importants dans un emplacement indépendant, avec des droits d'accès appropriés.

## Contrôles

- Vérifier régulièrement que les liens Drive du catalogue ouvrent les bons dossiers.
- Vérifier que les droits de partage permettent aux étudiants concernés de consulter les documents.
- Conserver les anciennes versions des fichiers JSON via l'historique Git.
- Tester périodiquement la restauration d'un dossier Drive et d'une version précédente du catalogue.
- Ne jamais committer de mot de passe, jeton ou secret.

Le site public actuel ne dépend pas d'une base D1. Les anciens fichiers D1/Worker sont conservés comme éléments hérités et ne font pas partie du flux de publication statique.
