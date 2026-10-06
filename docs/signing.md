# Clés de signature et empreintes

Une application Android est identifiée par son **nom de package** et par le **certificat** qui la signe. Plusieurs services vérifient ce certificat au moyen de son **empreinte** (SHA-1 ou SHA-256) : il faut la leur déclarer.

Les empreintes ne sont pas des secrets : elles identifient une clé publique (`assetlinks.json` en publie deux). Les **clés** elles-mêmes (keystores, mots de passe) ne doivent jamais être commitées.

## Les trois clés

| Clé | Ce qu'elle signe | Où elle est | SHA-256 |
|---|---|---|---|
| **Signature Google Play** (*app signing key*) | L'application **installée depuis le Play Store** : Google re-signe l'`.aab` envoyé | Chez Google, inaccessible | `34:CE:57:9C:8E:EA:EB:1B:72:16:51:45:64:81:3D:82:2E:B7:71:4D:28:E7:B0:C7:27:61:48:DC:C1:A2:04:E5` |
| **Importation** (*upload key*) | L'`.aab` produit par `eas build`, avant son envoi au Play Store | Credentials EAS (`npx eas-cli credentials`) | `71:B4:F8:FB:48:F2:F5:87:5F:D6:89:BD:92:F4:6B:55:4A:8D:42:EA:29:8E:FF:8F:EF:16:52:C9:EF:83:6D:C8` |
| **Debug** | Les builds locaux (`expo run:android`, `npm run android:dev`) | `apps/mobile/android/app/debug.keystore`, recréé par `expo prebuild` | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

La clé de debug est celle du **modèle React Native** : la même dans tous les projets React Native et Expo, avec un mot de passe public (`android`). Conséquences :

- les builds locaux de tous les contributeurs ont la même empreinte : déclarée une fois, elle fonctionne pour tous ;
- **elle ne prouve rien** : n'importe qui peut signer une application avec. La déclarer pour le package de **production** (Huawei aujourd'hui) permettrait à une application tierce de se présenter comme Step Challenge auprès de ce service. Le risque est faible (le consentement de l'utilisateur reste demandé, et l'application ne s'installerait pas à côté de celle du Store), mais il vaut mieux la retirer une fois les tests terminés, ou réserver la clé de debug au package de développement (`.dev`).

## Où lire les empreintes

- **Clés Google Play et d'importation** : Play Console → Step Challenge → Tester et publier → Configuration → **Intégrité de l'appli** → onglet **Signature de l'appli**. Pour chaque certificat : MD5, SHA-1 et SHA-256.
- **Clé d'importation**, aussi : `npx eas-cli credentials` (Android, production).
- **Clé de debug** (SHA-1 : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`), après un `expo prebuild` :

  ```bash
  cd apps/mobile
  keytool -J-Duser.language=en -list -v -keystore android/app/debug.keystore \
    -alias androiddebugkey -storepass android | grep -E 'SHA1|SHA256'
  ```

## Où elles sont déclarées

| Service | Empreinte | Clés déclarées | Pourquoi |
|---|---|---|---|
| **App Links** : `site/static/.well-known/assetlinks.json` (servi par le site public) | SHA-256 | Google Play, importation | Android vérifie que l'application qui ouvre les liens `https://step.architech.lu/i/…` est bien la nôtre. La clé de debug est volontairement absente : la variante de développement utilise son propre schéma d'URL |
| **Connexion Google** : Google Cloud → API et services → Identifiants → un **client OAuth Android** par empreinte | SHA-1 | Google Play et importation (package de production) ; debug (package `.dev` de la variante de développement) | Google n'accepte la connexion que depuis une application dont le package et l'empreinte correspondent à un client Android |
| **Huawei** : AppGallery Connect → Project settings → General information | SHA-256 | Google Play, importation, debug | HMS Core vérifie l'application avant d'autoriser Health Kit (voir `huawei/README.md`, section 14) |

## Quand faut-il y revenir ?

- **Nouveau service** qui identifie l'application : y déclarer au minimum la clé **Google Play**, celle des utilisateurs.
- **Nouvel ordinateur** : rien à faire, la clé de debug est la même partout.
- **Changement de la clé d'importation** (perte, rotation) : mettre à jour les trois services. Après un ajout chez Huawei, re-télécharger `agconnect-services.json` et mettre à jour la variable EAS (voir `huawei/README.md`).
- **Symptôme typique d'une empreinte manquante** : la fonction marche avec un build local mais pas avec l'application du Store (ou l'inverse). C'est presque toujours la clé Google Play qui manque.
