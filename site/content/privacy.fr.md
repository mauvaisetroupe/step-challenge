---
title: Politique de confidentialité — Step Challenge
linkTitle: Confidentialité
description: Les données collectées par Step Challenge, pourquoi, et comment les supprimer.
updated: 4 octobre 2026
---

*Traduction de la version anglaise, qui fait foi en cas de divergence.*

Step Challenge est une application de comptage de pas et de défis qui
permet à ses utilisateurs de suivre leurs pas quotidiens et de
participer à des défis de pas.

## 1. Données collectées

Step Challenge ne collecte que les données nécessaires à la fourniture
de ses services.

### Informations de compte

Les utilisateurs se connectent à Step Challenge avec leur compte Google.
Lors de la connexion, Google fournit à l'application un jeton d'identité
signé. De ce jeton, Step Challenge ne conserve que :

- l'identifiant technique et stable du compte Google (le « subject »
  OpenID Connect), qui sert à reconnaître l'utilisateur à sa connexion
  suivante ;
- un nom affiché choisi par l'utilisateur, visible des autres
  participants. L'application propose le prénom du compte Google, que
  l'utilisateur peut modifier avant de l'enregistrer, puis à tout
  moment.

Step Challenge ne conserve **pas** l'adresse e-mail de l'utilisateur, sa
photo de profil ni aucune autre information de son compte Google, et
n'accède à aucun service Google en son nom.

Après la connexion, l'application conserve un jeton de session dans le
stockage sécurisé de l'appareil (Android Keystore). Le serveur ne
conserve qu'une empreinte cryptographique de ce jeton.

### Données de pas

Avec l'autorisation de l'utilisateur, Step Challenge peut lire le nombre
de pas enregistré par la plateforme de santé disponible sur son
appareil.

Sur Android, Step Challenge utilise **Santé Connect** (Health Connect)
pour lire les pas enregistrés par le téléphone ou par des appareils et
applications compatibles (par exemple Garmin, Samsung ou Xiaomi). Step
Challenge ne demande qu'un accès en lecture aux données de pas.

Sur les appareils Huawei, Step Challenge utilise **Huawei Health Kit**
pour accéder aux nombres de pas mis à disposition par Huawei Santé et
les appareils compatibles.

Les données de pas peuvent comprendre :

- le nombre de pas enregistré pour une journée donnée ;
- la date associée à ce nombre de pas.

Step Challenge ne demande pas l'accès à d'autres informations de santé,
comme la fréquence cardiaque, le sommeil, la tension artérielle, les
mesures corporelles ou des informations médicales, sauf si un tel accès
est explicitement décrit dans une version future de l'application.

## 2. Utilisation des données de pas

Les données de pas servent uniquement au fonctionnement de Step
Challenge, notamment :

- afficher le nombre de pas quotidien de l'utilisateur ;
- afficher l'historique et les statistiques de pas ;
- calculer les résultats des défis et des classements ;
- synchroniser les nombres de pas avec le service Step Challenge.

Les données de pas ne sont utilisées ni à des fins de publicité, ni de
profilage, ni de marketing, ni à des fins médicales.

Les données de pas obtenues par Huawei Health Kit ne sont ni vendues ni
partagées avec des tiers pour leurs propres besoins de publicité ou de
profilage.

## 3. Huawei Health Kit

Sur les appareils Huawei compatibles, Step Challenge utilise Huawei
Health Kit pour accéder aux données d'activité autorisées.

Step Challenge ne peut accéder aux données de Health Kit qu'après que
l'utilisateur a accordé l'autorisation correspondante.

L'utilisateur peut retirer cette autorisation dans les paramètres de
confidentialité et d'autorisations de Huawei Santé ou de l'appareil.

Si l'autorisation est refusée ou retirée, Step Challenge ne peut plus
récupérer de nouvelles données de pas depuis Huawei Health Kit. Les
données déjà synchronisées peuvent rester conservées par Step Challenge
jusqu'à leur suppression conformément à la présente politique.

## 4. Synchronisation avec les serveurs de Step Challenge

Lorsque la synchronisation est activée, Step Challenge envoie les
nombres de pas quotidiens de l'utilisateur au serveur de Step Challenge.

Le serveur conserve les nombres de pas associés au compte Step Challenge
de l'utilisateur, afin que l'application puisse :

- synchroniser les données entre appareils ;
- tenir l'historique des pas ;
- calculer les défis ;
- fournir les classements.

Le serveur ne reçoit pas l'ensemble de la base de données Huawei Santé
de l'utilisateur. Step Challenge ne traite que les informations de pas
nécessaires à l'application.

## 5. Partage des données

Step Challenge ne vend pas de données personnelles.

Step Challenge ne partage pas les données de pas avec des annonceurs,
des courtiers en données ou d'autres tiers à des fins de publicité ou de
profilage.

Les données de pas peuvent être traitées par les prestataires techniques
nécessaires au fonctionnement de l'application et de son
infrastructure, le cas échéant, et uniquement pour les besoins de la
fourniture du service.

## 6. Durée de conservation

Step Challenge ne conserve les données de pas synchronisées que le temps
nécessaire au fonctionnement de l'application, notamment l'historique
des pas, les défis et les statistiques.

L'utilisateur peut supprimer son compte Step Challenge à tout moment
depuis l'application : **Paramètres → Supprimer mon compte**. Cette
action supprime immédiatement et définitivement, sur le serveur, le
compte, son nom affiché, son lien avec le compte Google, ses sessions et
tout son historique de pas. Les données de pas enregistrées dans Santé
Connect ou Huawei Santé sur l'appareil ne sont pas concernées.

L'utilisateur qui n'a plus accès à l'application peut demander la
suppression de son compte et des données associées sur le serveur par
e-mail (voir la section Contact). Les deux procédures sont décrites sur
la [page de suppression de compte]({{< relref "delete-account" >}}).

Les données conservées localement sur l'appareil de l'utilisateur
peuvent aussi être supprimées en désinstallant l'application ou en
utilisant les fonctions de suppression de données qu'elle propose.

## 7. Sécurité

Des mesures techniques et organisationnelles raisonnables protègent les
données de Step Challenge contre l'accès, la modification, la
divulgation ou la destruction non autorisés.

## 8. Tes droits

Selon la législation applicable en matière de protection des données,
les utilisateurs peuvent disposer notamment des droits suivants :

- accès à leurs données personnelles ;
- rectification des données inexactes ;
- effacement de leurs données personnelles ;
- retrait du consentement lorsque le traitement repose sur le
  consentement ;
- limitation de certains traitements ou opposition à ceux-ci ;
- portabilité des données, le cas échéant.

Les utilisateurs peuvent aussi retirer à Step Challenge l'accès aux
données de Huawei Santé dans les paramètres d'autorisations de Huawei
Santé ou de l'appareil.

## 9. Protection des enfants

Step Challenge n'a pas vocation à collecter sciemment des informations
personnelles d'enfants en violation de la législation applicable.

## 10. Modifications de cette politique

Cette politique de confidentialité peut être mise à jour lorsque Step
Challenge introduit de nouvelles fonctionnalités ou lorsque les
exigences légales ou techniques évoluent.

La dernière version est toujours publiée à l'adresse de la politique de
confidentialité communiquée aux utilisateurs et aux plateformes de
distribution d'applications.

## 11. Contact

Pour toute question sur cette politique de confidentialité, sur les
données personnelles ou pour toute demande concernant tes données,
contacte :

Step Challenge est développé et exploité par **Lionel Coquin**, à titre
de particulier, responsable du traitement des données personnelles
traitées par l'application et son serveur.

**Step Challenge — Lionel Coquin**\
E-mail : **support@architech.lu**

## 12. Open source

Le code source de l'application et du serveur Step Challenge est public,
sous licence GNU Affero General Public License (AGPL-3.0), afin que
chacun puisse vérifier la façon dont les données sont traitées :
[github.com/mauvaisetroupe/step-challenge](https://github.com/mauvaisetroupe/step-challenge).
