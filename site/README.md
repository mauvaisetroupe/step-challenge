# Site public

Site statique de Step Challenge, généré par [Hugo](https://gohugo.io) et publié sur l'hébergement OVH sous `https://step.architech.lu` ([ADR 0005](../docs/adr/0005-public-site-and-domains.md)).

Gabarits maison, sans thème tiers. Aucun service tiers : ni statistiques, ni polices, ni scripts externes, ni cookie.

## Lancer en local

Installer **la version de Hugo figée dans la GitHub Action** (`hugo-version` dans [`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml), aujourd'hui **0.167.0**), par exemple :

```bash
# macOS (Homebrew installe la dernière version : vérifier avec hugo version)
brew install hugo

# Ou une version précise, sans droits administrateur
pip install hugo==0.167.0
```

Puis :

```bash
cd site
hugo server        # http://localhost:1313/, rechargé à chaque modification
hugo --minify      # construction complète dans site/public/ (ignoré par git)
```

`hugo server` ne lit pas le `.htaccess` : la réécriture de `/i/<code>` ne fonctionne qu'avec Apache (voir « Vérifier le `.htaccess` »).

## Structure

| Chemin | Contenu |
|---|---|
| `hugo.toml` | Configuration : langues, adresse du site, paramètres (lien Play Store, e-mail de contact) |
| `content/` | Pages en Markdown, une par langue : `privacy.en.md` et `privacy.fr.md` |
| `content/help/` | Section d'aide : Santé Connect, Huawei |
| `layouts/` | Gabarits : `baseof.html` (squelette), `home.html`, `page.html`, `section.html`, `home.sitemapxml.xml` (sitemap), `robots.txt` |
| `layouts/_partials/` | En-tête, pied de page, sélecteur de langue et drapeaux (SVG intégrés), `url.html` (adresse sans `index.html` final) |
| `assets/css/site.css` | Feuille de style, minifiée et empreinte à la construction |
| `i18n/` | Textes des gabarits (`en.toml`, `fr.toml`) |
| `static/` | Copié tel quel : logo, `.htaccess`, `.well-known/assetlinks.json`, page `i/index.html`, marqueur `.step-challenge-site` |
| `scripts/deploy-sftp.sh` | Envoi du site chez OVH en SFTP (voir « Déploiement ») |

### Langues

- Anglais, langue par défaut, **à la racine** ; français sous `/fr/`. Aucune adresse en `/en/`.
- Adresses en `.html` (`uglyURLs`) : `content/privacy.en.md` donne `/privacy.html`, `content/privacy.fr.md` donne `/fr/privacy.html`. Les anciennes URL déclarées chez Google et Huawei sont donc les pages elles-mêmes, sans redirection. L'accueil et les index de section s'écrivent avec un `/` final (`/`, `/fr/`, `/help/`) grâce au partial `url.html`.
- **Mêmes chemins dans les deux langues** : seul le préfixe `/fr` s'ajoute. Le nom du fichier fixe le chemin, le suffixe la langue.
- **Sitemap unique** `/sitemap.xml` (gabarit `layouts/home.sitemapxml.xml`), avec les pages des deux langues et leurs traductions (`hreflang`), annoncé par `/robots.txt`. Il remplace celui de Hugo, qui en multilingue placerait le sitemap anglais sous `/en/`. Une nouvelle page y apparaît automatiquement.
- Le drapeau de l'en-tête mène à la même page dans l'autre langue (`.Translations`).
- Les versions françaises des pages légales sont des traductions ; la version anglaise fait foi (mention en tête de page).

### Fichiers particuliers de `static/`

- **`.well-known/assetlinks.json`** : vérification des App Links par Android. Package et empreintes SHA-256 des clés Google Play et d'importation (voir [`docs/signing.md`](../docs/signing.md)). Doit rester identique à ce que servait `backend/src/routes/appLinks.ts`, et être servi en `application/json`, sans redirection.
- **`.htaccess`** : règles Apache (réécriture de `/i/<code>` vers `/i/index.html`, type JSON pour `assetlinks.json`).
- **`i/index.html`** : page d'un invité qui n'a pas l'application. Un script lit le code dans l'adresse ; aucune ressource externe, `noindex`, `no-referrer`, et une `Content-Security-Policy` qui interdit tout appel extérieur : le code d'invitation ne doit fuiter vers personne. Page bilingue, langue choisie d'après le navigateur.
- **`images/logo.svg`** : dérivé de `icons/app-icon-foreground.svg` (chaussure blanche agrandie sur le fond bleu `#1389FC`). À régénérer si l'icône change.

## Ajouter une page

1. Créer les deux fichiers, avec le même nom : `content/guide.en.md` et `content/guide.fr.md` (ou `content/help/guide.*.md` pour une page d'aide).
2. En-tête de chaque fichier :

   ```yaml
   ---
   title: User guide           # titre de la page
   linkTitle: Guide            # facultatif : titre court dans les liens
   description: …              # résumé (moteurs de recherche, liste de l'aide)
   weight: 3                   # facultatif : ordre dans la liste de l'aide
   ---
   ```

3. Lier les pages entre elles avec `relref`, qui garde la langue et vérifie le lien à la construction : `[aide Huawei]({{</* relref "help/huawei" */>}})`.
4. Vérifier avec `hugo server` que la page existe dans les deux langues et que le drapeau mène à la bonne page.

Le HTML brut est désactivé dans le Markdown (`unsafe = false`) : un besoin de mise en forme particulière passe par un gabarit ou un shortcode.

## Déploiement

La GitHub Action [`deploy-site.yml`](../.github/workflows/deploy-site.yml) :

- sur une **pull request** qui touche `site/` : construit le site et vérifie la présence des fichiers cachés (contrôle seulement) ;
- sur un **push sur `main`** qui touche `site/` (ou lancement manuel) : construit, puis envoie `site/public/` chez OVH en **SFTP** avec [`scripts/deploy-sftp.sh`](scripts/deploy-sftp.sh) (lftp).

Tant que la configuration ci-dessous n'est pas complète, l'envoi est **sauté** (avec un avertissement) : la construction tourne, rien n'est envoyé.

### Comment se passe l'envoi

- **Chiffré et authentifié** : SFTP (port 22), et le serveur est reconnu par sa clé d'hôte (`SFTP_KNOWN_HOSTS`) ; une clé différente fait échouer l'envoi.
- **Miroir** : le dossier distant devient identique à `site/public/`. Les fichiers qui ne sont plus dans le site sont **supprimés** côté serveur. Tout est renvoyé à chaque fois (quelques centaines de kilo-octets) : Hugo réécrit tous les fichiers à chaque construction.
- **Garde-fou** : le site contient un fichier `.step-challenge-site`. Le script refuse d'envoyer dans un dossier distant qui n'est ni vide ni marqué par ce fichier : une erreur de `SITE_REMOTE_DIR` ne peut pas effacer un autre site.
- **Rien n'est commité** par l'action.

Testé contre un serveur SFTP local (authentification par mot de passe) : premier envoi, suppression d'un fichier retiré, refus d'un dossier étranger, refus d'une mauvaise clé d'hôte et d'un mauvais mot de passe.

### Secrets et variables à créer

GitHub → dépôt → Settings → Secrets and variables → Actions :

| Nom | Type | Valeur |
|---|---|---|
| `FTP_SERVER` | Secret | Serveur SFTP de l'hébergement OVH (espace client OVH → Hébergements → onglet FTP - SSH, « Serveur FTP et SFTP »), sans `sftp://` ni port |
| `FTP_USERNAME` | Secret | Utilisateur FTP/SFTP. De préférence un utilisateur dédié au site, limité à son dossier |
| `FTP_PASSWORD` | Secret | Mot de passe de cet utilisateur |
| `SITE_REMOTE_DIR` | Variable | Dossier distant du site, relatif au dossier de connexion, par exemple `step`. Doit être la racine du multisite du site dans OVH |
| `SFTP_KNOWN_HOSTS` | Variable | Clé d'hôte du serveur, obtenue une fois depuis un poste de confiance : `ssh-keyscan -p 22 <serveur>` (coller toutes les lignes). Ce n'est pas un secret |

Pour contrôler la clé obtenue, se connecter une fois à la main (`sftp <utilisateur>@<serveur>`) et comparer l'empreinte affichée avec `ssh-keygen -lf` sur la ligne collée.

### Envoyer à la main

Depuis `site/`, avec lftp installé, après `hugo --minify` :

```bash
export SFTP_HOST=… SFTP_USER=… REMOTE_DIR=step
export SFTP_KNOWN_HOSTS="$(ssh-keyscan -p 22 "$SFTP_HOST")"
read -rs LFTP_PASSWORD && export LFTP_PASSWORD
scripts/deploy-sftp.sh
```

### À vérifier au premier déploiement

- **Préversion** : publier d'abord sous un nom temporaire (ADR 0005, ordre de bascule), puis vérifier pages, anciennes URL et `assetlinks.json`.
- Que l'utilisateur SFTP arrive bien dans le dossier attendu (le chemin de `SITE_REMOTE_DIR` est relatif à son dossier de connexion).

### Vérifier le `.htaccess`

Il a été testé avec Apache 2.4 (`AllowOverride All`, `mod_rewrite`). Sur l'hébergement, vérifier :

```bash
SITE=https://step.architech.lu   # ou le nom temporaire de la préversion
curl -sI $SITE/                              # 200, accueil anglais
curl -sI $SITE/privacy.html                  # 200, sans redirection
curl -sI $SITE/agreement.html                # 200, sans redirection
curl -sI $SITE/delete-account.html           # 200, sans redirection
curl -sI $SITE/fr/privacy.html               # 200
curl -sI $SITE/i/K7F3-M9QX                   # 200, page d'invitation
curl -sI $SITE/.well-known/assetlinks.json   # 200, Content-Type: application/json, sans redirection
```

Puis, pour les App Links : [Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator) de Google, ou `adb shell pm get-app-links lu.architech.stepchallenge` après réinstallation de l'application.
