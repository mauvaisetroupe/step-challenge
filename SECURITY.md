# Politique de sécurité

Step Challenge traite des données de santé (nombre de pas). Les vulnérabilités sont prises au sérieux.

## Signaler une vulnérabilité

**N'ouvrez pas d'issue publique.**

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**. Le signalement n'est visible que par les mainteneurs.

Merci d'indiquer :

- la partie concernée (application Android, backend, site web) et la version ;
- les étapes permettant de reproduire le problème ;
- l'impact estimé (accès aux données d'autrui, usurpation, déni de service…).

## Ce qui suit un signalement

- Accusé de réception sous 7 jours.
- Correction, puis publication d'un avis de sécurité (GitHub Security Advisory) mentionnant l'auteur du signalement, s'il le souhaite.

Step Challenge est maintenu par une seule personne, sur son temps libre : ces délais sont un objectif, pas un engagement contractuel.

## Périmètre

- Le code de ce dépôt (`apps/mobile`, `backend`).
- Le service hébergé `step.architech.lu`.

Les tests intrusifs contre le service hébergé (déni de service, accès aux données d'autres utilisateurs) ne sont pas autorisés : démontrez la vulnérabilité sur votre propre instance (le backend est auto-hébergeable, voir le README).
