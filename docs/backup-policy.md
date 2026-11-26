# Politique de sauvegarde — proposition

La durabilité du fournisseur de stockage ne remplace pas une sauvegarde restaurable.

## Copies

1. R2 : copie primaire des documents publiés.
2. Copie locale chiffrée : export périodique des documents et de la base, conservé hors ligne.
3. Copie hors site indépendante : sauvegarde chiffrée dans un compte ou fournisseur distinct.

## Contrôles

- Export D1 régulier.
- Synchronisation R2 vers les copies de sauvegarde.
- Manifest contenant clé d'objet, taille, date et SHA-256.
- Vérification des checksums après copie.
- Journal des opérations de restauration.
- Test de restauration périodique.
- Aucun secret ou fichier de configuration sensible dans Git.

Les fréquences, durées de rétention et quotas seront fixés avant le lancement public. Aucun service gratuit n'est considéré comme illimité ou garanti à vie.
