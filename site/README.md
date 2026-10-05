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
hugo server        # http://localhost:1313/en/, rechargé à chaque modification
hugo --minify      # construction complète dans site/public/ (ignoré par git)
```

`hugo server` ne lit pas le `.htaccess` : la réécriture de `/i/<code>` et les redirections des anciennes URL ne fonctionnent qu'avec Apache (voir « Vérifier le `.htaccess` »).

## Structure

| Chemin | Contenu |
|---|---|
| `hugo.toml` | Configuration : langues, adresse du site, paramètres (lien Play Store, e-mail de contact) |
| `content/` | Pages en Markdown, une par langue : `privacy.en.md` et `privacy.fr.md` |
| `content/help/` | Section d'aide : Santé Connect, Huawei |
| `layouts/` | Gabarits : `baseof.html` (squelette), `home.html`, `page.html`, `section.html`, `alias.html` (redirection de `/` vers `/en/`) |
| `layouts/_partials/` | En-tête, pied de page, sélecteur de langue et drapeaux (SVG intégrés) |
| `assets/css/site.css` | Feuille de style, minifiée et empreinte à la construction |
| `i18n/` | Textes des gabarits (`en.toml`, `fr.toml`) |
| `static/` | Copié tel quel : logo, `.htaccess`, `.well-known/assetlinks.json`, page `i/index.html` |

### Langues

- Anglais par défaut, chaque langue dans son dossier : `/en/…` et `/fr/…`. La racine `/` redirige vers `/en/`.
- **Mêmes chemins dans les deux langues** : seul le préfixe change. Le nom du fichier fixe le chemin, le suffixe la langue.
- Le drapeau de l'en-tête mène à la même page dans l'autre langue (`.Translations`).
- Les versions françaises des pages légales sont des traductions ; la version anglaise fait foi (mention en tête de page).

### Fichiers particuliers de `static/`

- **`.well-known/assetlinks.json`** : vérification des App Links par Android. Package et empreintes SHA-256 des clés Google Play et d'importation (voir [`docs/signing.md`](../docs/signing.md)). Doit rester identique à ce que servait `backend/src/routes/appLinks.ts`, et être servi en `application/json`, sans redirection.
- **`.htaccess`** : règles Apache (réécriture de `/i/<code>` vers `/i/index.html`, redirections 301 des anciennes URL `.html`, type JSON).
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
- sur un **push sur `main`** qui touche `site/` (ou lancement manuel) : construit, puis envoie `site/public/` vers OVH en FTPS, en différentiel ([FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action)). L'état de synchronisation (`.ftp-deploy-sync-state.json`) reste sur le serveur ; il n'est jamais commité.

Tant que la configuration ci-dessous n'est pas complète, l'envoi est **sauté** (avec un avertissement) : la construction tourne, rien n'est envoyé.

### Secrets et variable à créer

GitHub → dépôt → Settings → Secrets and variables → Actions :

| Nom | Type | Valeur |
|---|---|---|
| `FTP_SERVER` | Secret | Serveur FTP de l'hébergement OVH (espace client OVH → Hébergements → FTP - SSH), par exemple `ftp.clusterXXX.hosting.ovh.net` |
| `FTP_USERNAME` | Secret | Utilisateur FTP. De préférence un utilisateur dédié au site, limité à son dossier |
| `FTP_PASSWORD` | Secret | Mot de passe de cet utilisateur |
| `SITE_REMOTE_DIR` | Variable | Dossier distant du site, terminé par `/`, par exemple `./step/`. Doit être la racine du multisite `step.architech.lu` dans OVH. **Ne pas** indiquer le dossier d'un autre site : l'action y supprimerait les fichiers qu'elle a elle-même envoyés |

### À vérifier au premier déploiement

- **FTPS** : l'action utilise `protocol: ftps`. Si OVH refuse la connexion chiffrée (ou le certificat), ne pas repasser en FTP en clair : utiliser une action SFTP si l'offre d'hébergement le permet.
- **Préversion** : publier d'abord sous un nom temporaire (ADR 0005, ordre de bascule), puis vérifier pages, redirections et `assetlinks.json`.

### Vérifier le `.htaccess`

Il a été testé avec Apache 2.4 (`AllowOverride All`, `mod_rewrite`). Sur l'hébergement, vérifier :

```bash
HOST=https://step.architech.lu   # ou le nom temporaire de la préversion
curl -sI $HOST/                              # 200 (redirection HTML vers /en/)
curl -sI $HOST/privacy.html                  # 301, Location: /en/privacy/
curl -sI $HOST/agreement.html                # 301, Location: /en/agreement/
curl -sI $HOST/delete-account.html           # 301, Location: /en/delete-account/
curl -sI $HOST/i/K7F3-M9QX                   # 200, page d'invitation
curl -sI $HOST/.well-known/assetlinks.json   # 200, Content-Type: application/json, sans redirection
```

Puis, pour les App Links : [Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator) de Google, ou `adb shell pm get-app-links lu.architech.stepchallenge` après réinstallation de l'application.
