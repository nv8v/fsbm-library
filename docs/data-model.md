# Modèle de données cible

Schéma initial implémenté pour Cloudflare D1 in `migrations/0001_initial.sql`.

- `faculties`: établissement/faculté.
- `programmes`: parcours ou diplôme.
- `semesters`: numéro, libellé et programme parent.
- `modules`: code, libellé et semestre parent.
- `resources`: métadonnées, type, statut, clé R2, taille, checksum SHA-256 et année universitaire.
- `resource_requests`: demandes étudiantes et statut de traitement.
- `admin_users`: identifiant interne, e-mail, hash du mot de passe, rôle et statut.
- `sessions`: hash du jeton de session et date d’expiration.
- `login_attempts`: limitation des tentatives de connexion et des demandes publiques.
- `activity_logs`: acteur, action, cible, horodatage.

Les documents eux-mêmes sont stockés dans R2. D1 ne conserve que leurs métadonnées et leurs clés d'objet.

## Types initiaux

`Cours`, `TD`, `TP`, `Examens`, `Corrigés`, `Résumés`, `Projets`, `Autres`.

## Règles

- Les semestres appartiennent à un programme.
- Les modules appartiennent à un semestre.
- Une ressource appartient à un module.
- Chaque fichier R2 reçoit une clé générée côté Worker, distincte du nom de fichier fourni.
- Une ressource doit être archivée avant sa suppression définitive.
