# Comptes, consoles et secrets

Tout ce qui existe hors du dépôt, et où le retrouver.

## Comptes et consoles

| Service | Sert à |
|---|---|
| GitHub, dépôt `mauvaisetroupe/step-challenge` | Code, CI (Actions), images (Packages, GHCR, publiques), notes de version (Releases), secrets du déploiement du site |
| GitHub, dépôt `mauvaisetroupe/vps-infra` (`../vps-infra`) | L'hébergement de l'API : VPS, composition de production, déploiement, sauvegardes, supervision |
| Expo (EAS), projet `step-challenge` | Credentials Android (clé d'importation), variables d'environnement par environnement, `versionCode` |
| Google Cloud, projet `step-challenge` | Connexion Google : clients OAuth Web et Android ([Signature Android](android-signing.md)) |
| Google Play Console, compte `mauvaisetroupe` | Publication, fiche, déclarations, accès de démonstration ([Publier sur Google Play](../how-to/publish-on-google-play.md)) |
| Huawei AppGallery Connect | Publication AppGallery, Health Kit, empreintes ([Publier sur AppGallery](../how-to/publish-on-appgallery.md)) |
| OVH, hébergement web | Le site public `step.architech.lu` (SFTP) |
| Cloudflare, zone `architech.lu` | Le tunnel vers le VPS (`step-api.architech.lu`), décrit dans `vps-infra` |

## Secrets

| Secret | Où | Sert à | Le changer |
|---|---|---|---|
| Keystore Android, alias, mots de passe | EAS (credentials, `npx eas-cli credentials`) | Signer les builds (clé d'importation) | Remplaçable par Google ([Signature Android](android-signing.md)) ; déclarer la nouvelle empreinte partout |
| Configuration de l'API (base, `DEMO_ACCESS_CODE`) | `.env` de l'utilisateur `step` sur le VPS (`vps-infra`) | Configuration de l'API et des migrations | Dans le `.env`, puis `deploy-app` |
| `DEMO_ACCESS_CODE` | Aussi : gestionnaire de mots de passe, Play Console (Contenu de l'application › Accès à l'application), AppGallery Connect (For reviewer) | Accès de démonstration des examinateurs | Partout à la fois, sinon l'examen échoue |
| `AGCONNECT_SERVICES_JSON` | Variable d'environnement EAS (type texte, contenu de `agconnect-services.json`) | Configuration AppGallery Connect dans le build | Re-télécharger le fichier après un changement d'empreinte chez Huawei |
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | GitHub, Settings → Secrets and variables → Actions | Envoi du site chez OVH | Dans l'espace client OVH, puis dans GitHub |

**Pas des secrets** (publics) : les identifiants clients OAuth Google, les empreintes des clés, `SFTP_KNOWN_HOSTS`,
l'adresse de l'API.

Aucun secret ne va dans le dépôt, public : voir « Ce qu'il ne faut jamais faire » dans [`STATUS.md`](../STATUS.md).
La CI le vérifie (gitleaks, [CI](ci.md)).
