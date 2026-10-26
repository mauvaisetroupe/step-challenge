# Publication : mettre en production chaque partie

Comment le mainteneur publie chaque partie de Step Challenge : versions du backend, site, application sur les boutiques. C'est le mainteneur qui agit sur la production (serveur, base, consoles des boutiques) ; une session d'assistant prépare et guide, sans y toucher.

Le backend est livré sous forme d'images ([ADR 0011](adr/0011-backend-hosting.md)) : leur exploitation (variables, port, santé, migrations, mises à jour) est décrite pour un exploitant dans [`exploitation.md`](exploitation.md). L'hébergement lui-même (machine, composition de production, tunnel, sauvegardes) est tenu par l'exploitant, hors de ce dépôt.

Le détail de la configuration reste à sa place, cette page y renvoie : backend et application dans le [README](../README.md), site dans [`site/README.md`](../site/README.md), clés de signature dans [`signing.md`](signing.md), intégration Huawei dans [`huawei/README.md`](../huawei/README.md).

## Vue d'ensemble

| Partie | Où | Comment | Déclencheur |
|---|---|---|---|
| Backend (API et migrations) | Images `ghcr.io/mauvaisetroupe/step-challenge-api` et `step-challenge-migrations` | CI GitHub (`ci.yml`, job `images`), puis déploiement par l'exploitant ([`exploitation.md`](exploitation.md)) | Tag git `api-vX.Y.Z` |
| Site public (`step.architech.lu`) | Hébergement mutualisé OVH | GitHub Action `deploy-site.yml` (Hugo puis SFTP) | Push sur `main` qui touche `site/` |
| Application Android, Google Play | Play Console, test fermé | Build EAS en local (`.aab`), envoi dans la Play Console | À la main |
| Application Android, Huawei AppGallery | AppGallery Connect | Build EAS en local (APK signé avec la clé d'envoi), envoi dans AppGallery Connect | À la main |

Jusqu'à la bascule de l'ADR 0011, la production de l'API reste sur l'ancien conteneur LXC du home lab (voir « Ancienne production » plus bas).

## Ordre d'une mise en production

Quand une version touche plusieurs parties, dans cet ordre :

1. **Backend** : notes de version, tag `api-vX.Y.Z`, puis déploiement par l'exploitant (sauvegarde, image de migration, image de l'API).
2. **Site** : pages légales et aide à jour (politique de confidentialité si la collecte change), **avant** l'envoi aux boutiques : les examinateurs la lisent.
3. **Application** : build, puis envoi à Google Play et à AppGallery, avec les déclarations des consoles mises à jour si les autorisations ou les données changent.
4. **`docs/STATUS.md`** : version, date, ce qui reste à vérifier.

## Backend : publier une version

Chaque push sur `main` publie déjà les deux images sous `sha-<commit>`, une fois les tests passés : de quoi essayer un commit précis. Une **version** se publie par un tag :

1. Dans [`backend/CHANGELOG.md`](../backend/CHANGELOG.md), compléter la section de la version et la dater : d'abord ce qui change pour l'exploitant (variables, migrations lourdes ou sans retour en arrière, version de PostgreSQL), puis le reste. Sans cette section, la CI refuse de créer la release.
2. Si une variable change, mettre à jour [`exploitation.md`](exploitation.md) dans le même commit.
3. Pousser sur `main`, attendre une CI verte, puis poser le tag :

   ```bash
   git tag api-v1.0.0
   git push origin api-v1.0.0
   ```

4. La CI publie les deux images sous `1.0.0` et `1.0`, puis la GitHub Release « API 1.0.0 » avec la section du changelog.

Le numéro suit le sens habituel : correctif (`1.0.1`), ajout compatible (`1.1.0`), changement qui demande une action de l'exploitant ou empêche le retour en arrière (`2.0.0`). Il est indépendant de la version de l'application mobile. Un tag de préversion (`api-v1.1.0-rc.1`) ne publie que les images `sha-…`, sans version ni release.

À la première publication, les paquets GHCR sont privés : les passer en public une fois (Packages → paquet → Package settings → Change visibility).

## Ancienne production (LXC du home lab, jusqu'à la bascule)

L'API tourne encore dans un conteneur LXC (`/opt/step-challenge`, service systemd `step-challenge-api`), avec `deploy.sh` (`git pull`, `npm ci`, `npm run build`, redémarrage, attente de `/api/health`) et `install-step-challenge.sh` pour un nouveau serveur. **Ce conteneur n'est plus déployé** depuis le passage à Flyway : sa base n'a pas d'historique Flyway, et l'API actuelle refuserait d'y démarrer. Il garde l'ancien code jusqu'à la bascule ; ces deux scripts seront retirés ensuite.

Si un correctif urgent devait y être déployé avant la bascule, le faire depuis une branche partant du dernier commit déployé, et appliquer une éventuelle migration à la main (`psql -v ON_ERROR_STOP=1 -f backend/migrations/V00N__….sql`, après un `pg_dump`).

## Site public

Un push sur `main` qui touche `site/` construit le site (Hugo 0.167.0) et l'envoie chez OVH en SFTP : rien d'autre à faire. Une pull request qui touche `site/` construit seulement. L'action se relance à la main depuis l'onglet Actions de GitHub (`workflow_dispatch`).

Vérifier ensuite la page modifiée en ligne, dans les deux langues (`/page.html` et `/fr/page.html`).

Secrets GitHub, garde-fou du dossier distant, envoi à la main et vérification du `.htaccess` : voir [`site/README.md`](../site/README.md#déploiement).

## Application Android

### Avant le build

- **Version** : monter `version` dans `apps/mobile/app.json` (affichée aux utilisateurs, et dans les notes de version). Le `versionCode` n'est pas à toucher : EAS l'incrémente à chaque build de production (`appVersionSource: remote`, `autoIncrement`).
- **Place disque** : un build local compile dans `$TMPDIR` et demande une dizaine de Go libres (`df -h`). Les anciennes versions de `~/.gradle/caches` et `~/.gradle/wrapper/dists`, le cache npm et le cache de build Docker se suppriment sans risque.
- **R8** : une nouvelle bibliothèque native peut casser en production seulement (code obscurci). Tester en release avant d'envoyer, et ajouter les règles manquantes dans `extraProguardRules` (`app.json`), d'après `android/app/build/outputs/mapping/release/missing_rules.txt`.

EAS cloud ne sert qu'à stocker les credentials Android (keystore, alias, mots de passe), les variables d'environnement par environnement et le `versionCode` : **les builds se font en local**. Credentials : `npx eas-cli credentials` ; variables : `npx eas-cli env:list --environment production`.

### Google Play

```bash
cd apps/mobile
npx eas-cli build --platform android --profile production --local
```

Le build produit un `.aab` signé avec la clé d'importation. Dans la Play Console : test fermé → nouvelle version → envoyer le `.aab`, notes de version (français et anglais), puis envoyer pour examen. Google re-signe avec sa propre clé (voir [`signing.md`](signing.md)).

Si la version change les autorisations ou les données collectées, mettre à jour avant l'envoi le formulaire Data safety et la déclaration « Health apps » de la Play Console (et la politique de confidentialité du site).

### Huawei AppGallery

```bash
cd apps/mobile
npx eas-cli build --platform android --profile appgallery --local
```

Le profil `appgallery` hérite de `production` (il consomme donc un `versionCode`) et en diffère sur deux points :

- **APK** au lieu d'un `.aab` : AppGallery n'accepte un `.aab` qu'avec son App Signing, qui imposerait une nouvelle clé à déclarer partout. L'APK est signé avec la clé d'importation d'EAS, déjà déclarée (voir [`signing.md`](signing.md)), et Huawei le distribue tel quel ;
- **podomètre du téléphone** activé (`PHONE_STEP_COUNTER=true`), avec l'autorisation « Activité physique », pour les téléphones sans Santé Connect ; le build Play ne l'a pas.

Vérifier l'APK avant de l'envoyer :

```bash
BT=$(ls -d ~/Library/Android/sdk/build-tools/* | sort -V | tail -1)
$BT/apksigner verify --print-certs <apk> | grep SHA-256                     # 71b4f8fb…
$BT/aapt2 dump badging <apk> | grep -E "^package|ACTIVITY_RECOGNITION"     # version, autorisation
$BT/aapt2 dump xmltree --file AndroidManifest.xml <apk> | grep -A2 hms.client.appid
```

Dans AppGallery Connect (Apps → Step Challenge → Distribute) :

1. **Version** : la version en cours (après un refus, celle marquée « To modify », à corriger et resoumettre plutôt que d'en créer une autre) → App version → **Manage packages** → envoyer l'APK, le sélectionner.
2. **Notes de version** : elles ne sont pas sur la page de la version mais dans **App information → Localization → New features**, une fois par langue (choisir la langue dans « Language », puis « Save » pour chacune).
3. **Captures d'écran** : même page, « Visual assets », obligatoires pour chaque langue ; les sources sont dans `docs/screenshots/`.
4. **Pour les examinateurs** (page de la version, « For reviewer ») : connexion requise, compte `demo`, mot de passe = code d'accès de démonstration (`DEMO_ACCESS_CODE`), remarque de 300 caractères au plus ; la remarque actuelle est dans [`huawei/README.md`](../huawei/README.md).
5. **Submit**. L'examen prend 3 à 5 jours.

Fiche, pays, classification par âge et données déclarées : voir [`huawei/README.md`](../huawei/README.md#publication-sur-appgallery).

**Envois qui échouent** (« Upload failed. Please try again later. », ou progression très lente) : un incident passager du stockage européen d'AppGallery, déjà rencontré le 2026-10-22 (le navigateur n'y est pour rien). Réessayer plus tard.

## Secrets et où ils sont

| Secret | Où | Sert à |
|---|---|---|
| Keystore Android, alias, mots de passe | EAS (credentials) | Signer les builds (clé d'importation) |
| Configuration de l'API (base, `DEMO_ACCESS_CODE`) | Chez l'exploitant (variables d'environnement des conteneurs) ; `/opt/step-challenge/backend/.env` sur l'ancien LXC | Configuration de l'API et des migrations |
| `DEMO_ACCESS_CODE` | Aussi : gestionnaire de mots de passe, Play Console (Accès à l'application), AppGallery Connect (For reviewer) | Accès de démonstration des examinateurs ; le changer impose de le changer partout |
| `AGCONNECT_SERVICES_JSON` | Variable d'environnement EAS (type texte, contenu de `agconnect-services.json`) | Configuration AppGallery Connect dans le build |
| Secrets SFTP du site | GitHub, Settings → Secrets and variables → Actions | Envoi du site chez OVH |

Aucun de ces secrets ne va dans le dépôt (voir « Ce qu'il ne faut jamais faire » dans [`STATUS.md`](STATUS.md)).
