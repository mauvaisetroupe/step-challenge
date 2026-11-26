# Vérification Huawei Health Kit : exigences et état

La permission de **test** de Health Service Kit (accordée le 2026-11-24, voir [l'intégration Huawei](../explanation/huawei-integration.md), section 16) limite l'application à **100 utilisateurs** et expire fin novembre 2027. La **vérification** (« Get verified ») lève cette limite et donne les scopes définitifs.

Cette page rassemble ce que Huawei demande pour la vérification, et où en est Step Challenge pour chaque point. Elle est tirée de deux sources, lues le 2026-11-26 :

- le guide [Applying for Verification](https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/verification-0000001211587947), dont la section des refus fréquents ;
- la check-list **App Release Checklist.xlsx**, liée depuis ce guide (onglets « Checklist » et « Privacy Compliance Checklist »). C'est elle qui fixe les critères d'acceptation ; elle se remplit et s'envoie avec la demande.

Le guide est une page très longue : son texte ne commence qu'après le menu de navigation, tout en bas. Huawei peut changer les deux documents : les relire avant de déposer la demande.

## La procédure

1. **Auto-contrôle** : ne garder cochés, sur HUAWEI Developers, que les scopes réellement utilisés (minimisation des données). Pour Step Challenge : la lecture des pas (`step.read`) et l'historique d'un mois (`historydata.open.month`, demandé à la connexion depuis la 1.17.0) ; l'écriture avait été cochée par erreur en octobre 2026.
2. **Demande** : HUAWEI Developers → Console → carte Health Service Kit → **Get verified**, choix des permissions à vérifier (une au moins), dépôt des pièces : une **vidéo par scénario** de la check-list, et la **check-list remplie**. Les vidéos doivent montrer le parcours complet de chaque scénario.
3. **Examen** par un groupe d'experts : environ **15 jours ouvrés**. Statut « to be verified » pendant l'examen. Les demandes de correction arrivent par e-mail (`hihealth@huawei.com`) : bouton **Update** pour envoyer les nouvelles pièces, puis répondre à l'e-mail. Un refus se corrige et se redépose (15 jours ouvrés de plus).
4. **Accord** : les scopes définitifs prennent effet sous **24 heures**.

Préalable : l'application doit être **publiée sur AppGallery** avec l'intégration (la 1.9.1 qui y est ne lit pas Huawei Health).

## Scénarios de la check-list (vidéos)

| Scénario | Critère d'acceptation (résumé) | État de Step Challenge |
|---|---|---|
| **1.1 Politique de confidentialité** | La vidéo montre le chemin vers la politique dans l'application. Nom du développeur et de l'application identiques à ceux de HUAWEI Developers (casse comprise). La politique décrit le but de la lecture des données de HUAWEI Health et les types de données lus. Transfert international décrit s'il y en a, option non cochée par défaut. | ✅ Plus → Informations légales → Politique de confidentialité. ✅ Pas quotidiens, et leur usage (section 3 de la politique). À vérifier : le nom du développeur (« Lionel Coquin ») et de l'application sur HUAWEI Developers. |
| **2.1 Marque HUAWEI Health** | Écrire « HUAWEI Health » ; utiliser correctement le logo HUAWEI Health ([règles](https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/specifications-0000001368356193), ressources à télécharger), jamais accolé à un autre texte. Refus fréquents : « Huawei Switch », « Huawei band/watch » sur une entrée ou dans un message. | ✅ « HUAWEI Health » dans l'application (1.16.0) et l'aide ; plus de « montre Huawei ». Aucun logo utilisé (pas obligatoire). |
| **3.1 Autorisation de l'utilisateur** | La vidéo montre la première demande d'accès et l'écran d'autorisation complet : seulement les permissions soumises à la vérification (pas de permission de test), icône de l'application correcte, pas d'icône HUAWEI. Les fonctions marchent ensuite. | ✅ Choix de HUAWEI Health dans Source des pas, ou depuis la carte de l'Accueil. À vérifier dans AGC : scopes cochés, nom et icône. |
| **3.2 Retrait de l'autorisation dans l'application** | On peut retirer l'autorisation dans l'application ; elle le confirme, ou redemande l'autorisation à l'ouverture suivante. | ✅ (1.16.0) Plus → Source des pas → **Retirer l'accès à HUAWEI Health**, avec confirmation, puis message « Accès retiré » ; aussi en revenant à Santé Connect (`cancelAuthorizationAll`). |
| **3.3 Retrait depuis l'application Huawei Health** | Huawei Health → Moi → photo de profil → Centre de confidentialité → Contrôler l'accès au compte → l'application → ANNULER L'AUTORISATION (ou Moi → Gestion de la confidentialité → Partage et autorisation des données). À l'ouverture suivante, l'application affiche l'écran d'autorisation ou un message. | ⚠️ (1.16.0) Un refus de connexion ou un jeton rejeté affiche « Step Challenge n'a pas accès à tes pas dans HUAWEI Health » et un bouton **Autoriser HUAWEI Health**, sur l'Accueil et dans Source des pas. Testé sur le Pixel le 2026-11-26 : l'écran d'autorisation réapparaît à l'ouverture suivante (accepté par Huawei). |
| **3.4 Autorisation incomplète** | Au moins une permission décochée sur l'écran d'autorisation. Les fonctions autorisées marchent ; les autres affichent un message ou proposent d'autoriser. Avec un seul scope : filmer l'écran avant et après l'avoir coché. | ✅ (1.16.0) Case des pas décochée : message et bouton **Autoriser HUAWEI Health** (testé sur le Pixel le 2026-11-26). Depuis la 1.17.0, deux cases : l'historique décoché, l'application marche et lit moins de jours (à filmer aussi). |
| **3.5 Interrupteur HUAWEI Health Kit coupé** | Huawei Health → Moi → Gestion de la confidentialité → HUAWEI Health Kit désactivé. À l'ouverture suivante, un message (ou une page H5) dit de le réactiver. (Pas exigé sous HarmonyOS 5.0 et plus.) Voir l'API `get-privacy-records`. | ⚠️ (1.16.0) Step Challenge décochée dans HUAWEI Health Kit : l'API REST refuse les jetons (401) ; message « HUAWEI Health Kit refuse l'accès à tes pas » et **Autoriser de nouveau** (retrait puis nouvelle autorisation). Testé sur le Pixel, mais dépend du gel de HMS Core ([intégration Huawei](../explanation/huawei-integration.md), section 16). Interrupteur général pas encore testé. |

## Conformité de la confidentialité (second onglet)

Chaque point s'auto-évalue dans la check-list, avec une explication en cas d'écart.

| Point | Exigence (résumé) | État de Step Challenge |
|---|---|---|
| Accord du développeur | Dire que HUAWEI Health Service Kit n'est pas un dispositif médical : données indicatives, jamais base d'un diagnostic. | ✅ Politique, section 2 : ni Step Challenge ni HUAWEI Health Kit ne sont des dispositifs médicaux (2026-11-26). |
| Données collectées | Types de données définis, minimisation. | ✅ Pas quotidiens seulement. |
| Usage des données | Un usage expliqué par type de donnée, pas un but générique. | ✅ Section 2 de la politique. |
| Stockage et conservation | Lieu (application ou cloud), durée, chiffrement ou anonymisation. | ✅ Politique, sections 4, 6 et 7 : serveur OVHcloud au Canada, sauvegardes chiffrées copiées en France, gardées 7 jours, HTTPS (2026-11-26). Suppose le chiffrement et la durée de 7 jours en place dans `vps-infra`. |
| Transfert international | Dire s'il y en a. | ⚠️ Dit (section 4) : transfert vers le Canada, fondé sur la décision d'adéquation de la Commission européenne. À expliquer dans la colonne Remarques ; disparaît quand le serveur passera en Europe. |
| Partage avec des tiers | Dire s'il y en a, et seulement avec accord explicite. | ✅ Section 5 (les amis, choisis par l'utilisateur). |
| Conditions d'utilisation | Pas de clause abusive. | ✅ À relire. |
| Traçabilité | Le serveur garde une trace de chaque autorisation accordée ou retirée. | ❌ Le serveur ne sait rien de l'autorisation HUAWEI. |
| Fuites | Contrôle d'accès ; aucune donnée personnelle dans les journaux. | ✅ Session par jeton, journaux sans données de pas (à vérifier). |
| Stockage sécurisé | Données sensibles chiffrées, et dit dans la politique. | ⚠️ Dit (section 7) : HTTPS, jeton dans le Keystore et empreinte côté serveur, accès restreint, sauvegardes chiffrées ; la base elle-même n'est pas chiffrée au repos (disque du VPS à vérifier : `lsblk -f`). |
| Information au premier usage | Afficher la politique de confidentialité et les conditions au premier usage ; un changement redemande l'accord. | ❌ Une phrase « tu acceptes les conditions » à la création du nom, sans la politique de confidentialité, et pas de nouvel accord après un changement. |
| Accès à Health Kit | Autorisation explicite de l'utilisateur pour lire. | ✅ Écran d'autorisation HUAWEI. |
| Refus | Sans accord sur la politique et les conditions, pas d'accès au service. | ❌ Pas d'accord explicite. |
| Droit de modifier | Une entrée claire pour retirer l'autorisation ; plus aucun accès ensuite ; l'historique gardé ou supprimé selon le choix de l'utilisateur. | ⚠️ Retrait au retour à Santé Connect ; l'historique reste jusqu'à la suppression du compte, sans choix. |
| Droit d'accès | Une entrée pour exporter toutes ses données personnelles. | ❌ Pas d'export. |
| Droit à l'effacement | Une entrée pour supprimer toutes ses données. | ✅ Plus → Compte → Supprimer mon compte. |
| Transmission à des tiers | Accord explicite, chiffrement en transit, dit dans la politique. | ✅ Pas de transmission à des tiers ; HTTPS. |

## Ce qu'il reste à faire, par lot

1. **Application** : fait pour la 1.16.0 (2.1, 3.2 à 3.5) ; reste à publier l'aide du site avec la version. Sur un téléphone non Huawei, le gel de HMS Core rendait la connexion et le retrait aléatoires ; la 1.16.0 réveille HMS Core avant chaque appel (testé sur le Pixel). Filmer de préférence sur un téléphone Huawei. Le profil et la photo du compte HUAWEI, cochés d'office sur l'écran d'autorisation, sont la connexion HUAWEI ID et non des permissions Health Kit : le dire dans la check-list (3.1).
2. **Politique de confidentialité** (`architech-sport`) : écrite le 2026-11-26 (pas un dispositif médical, hébergement au Canada, sauvegardes chiffrées en France gardées 7 jours, mesures de sécurité). À publier **après** le chiffrement des sauvegardes et le passage à 7 jours dans `vps-infra`. À mettre à jour quand le serveur passera en Europe.
3. **Accord et droits des utilisateurs** ([ADR 0017](../adr/0017-consent-and-user-rights.md), proposé ; backend et application) : écran d'accord explicite au premier usage et à chaque changement de la politique ou des conditions ; journal des accords sur le serveur, où l'application déclare les autorisations HUAWEI accordées ou retirées (l'[ADR 0016](../adr/0016-huawei-health-through-the-server.md), qui passerait l'autorisation par le serveur, reste en attente) ; export des données personnelles ; choix de garder ou supprimer les pas au retrait. Utile au-delà de Huawei (RGPD).
4. **Consoles** (le mainteneur) : scopes cochés, nom et icône de l'application dans AGC ; nom du développeur identique à celui de la politique.
5. **Publication** sur AppGallery d'une version avec l'intégration, puis vidéos, check-list et demande de vérification.

Hors de la vérification : les téléphones Huawei sans services Google (connexion HUAWEI ID, source par défaut, invitations sans Google Play) sont un autre chantier.
