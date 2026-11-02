# Publier l'application sur Huawei AppGallery

Même version et même commit que pour Google Play ([Publier sur Google Play](publish-on-google-play.md), étapes 1 et
2), avec un build propre à Huawei. L'historique de l'intégration Huawei (Health Kit, refus, fiche) est dans
[l'intégration Huawei](../explanation/huawei-integration.md).

## 1. Construire

```bash
cd apps/mobile
npx eas-cli build --platform android --profile appgallery --local
```

Le profil `appgallery` hérite de `production` (il consomme donc un `versionCode`) et en diffère sur deux points :

- **APK** au lieu d'un `.aab` : AppGallery n'accepte un `.aab` qu'avec son App Signing, qui imposerait une nouvelle
  clé à déclarer partout. L'APK est signé avec la clé d'importation d'EAS, déjà déclarée
  ([Signature Android](../reference/android-signing.md)), et Huawei le distribue tel quel ;
- **podomètre du téléphone** activé (`PHONE_STEP_COUNTER=true`), avec l'autorisation « Activité physique », pour les
  téléphones sans Santé Connect ; le build Play ne l'a pas.

La configuration AppGallery Connect vient de la variable EAS `AGCONNECT_SERVICES_JSON`
([Comptes, consoles et secrets](../reference/accounts-and-secrets.md)).

## 2. Vérifier l'APK

```bash
BT=$(ls -d ~/Library/Android/sdk/build-tools/* | sort -V | tail -1)
$BT/apksigner verify --print-certs <apk> | grep SHA-256                     # 71b4f8fb…
$BT/aapt2 dump badging <apk> | grep -E "^package|ACTIVITY_RECOGNITION"     # version, autorisation
$BT/aapt2 dump xmltree --file AndroidManifest.xml <apk> | grep -A2 hms.client.appid
```

## 3. Envoyer dans AppGallery Connect

Apps → Step Challenge → Distribute :

1. **Version** : la version en cours (après un refus, celle marquée « To modify », à corriger et resoumettre plutôt
   que d'en créer une autre) → App version → **Manage packages** → envoyer l'APK, le sélectionner.
2. **Notes de version** : elles ne sont pas sur la page de la version mais dans **App information → Localization →
   New features**, une fois par langue (choisir la langue dans « Language », puis « Save » pour chacune).
3. **Captures d'écran** : même page, « Visual assets », obligatoires pour chaque langue ; les sources sont dans
   `docs/screenshots/`.
4. **Pour les examinateurs** (page de la version, « For reviewer ») : connexion requise, compte `demo`, mot de passe
   = code d'accès de démonstration (`DEMO_ACCESS_CODE`), remarque de 300 caractères au plus ; la remarque actuelle est
   dans [l'intégration Huawei](../explanation/huawei-integration.md#publication-sur-appgallery).
5. **Submit**. L'examen prend 3 à 5 jours.

Fiche, pays, classification par âge et données déclarées : voir
[l'intégration Huawei](../explanation/huawei-integration.md#publication-sur-appgallery).

**Envois qui échouent** (« Upload failed. Please try again later. », ou progression très lente) : un incident passager
du stockage européen d'AppGallery, déjà rencontré le 2026-10-22 (le navigateur n'y est pour rien). Réessayer plus
tard.

## 4. Taguer et noter

Le tag `mobile-vX.Y.Z` est le même que pour Google Play ([étape 5](publish-on-google-play.md#5-taguer)). Mettre à
jour la ligne « Application » de [`STATUS.md`](../STATUS.md) (version AppGallery, date).
