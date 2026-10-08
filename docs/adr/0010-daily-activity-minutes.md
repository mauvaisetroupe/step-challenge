# ADR 0010 — Minutes actives et score d'activité dans la base

- **Statut** : Proposé
- **Date** : 2026-10-08
- **Décideur** : mauvaisetroupe

## Contexte

Depuis la 1.7.0, la vue Statistiques → 1 jour montre les périodes d'inactivité (trait rouge). L'étape suivante, faite dans l'application seule (sans serveur), y ajoute les minutes **très actives**, **actives** et **inactives** de la journée et un **score d'activité** (`services/activity.ts`) :

- une minute est **active** à partir de 100 pas par minute et **très active** à partir de 130 : repères de la recherche sur la cadence de marche (CADENCE-Adults, Tudor-Locke et al. 2018-2019) pour une intensité modérée et soutenue ;
- les minutes **inactives** sont celles des périodes rouges (`services/inactivity.ts` : 60 minutes sans 200 pas en 15 minutes, entre le premier et le dernier pas) ;
- **score = minutes actives + 2 × minutes très actives**. L'OMS (2020) recommande 150 minutes d'activité modérée par semaine, une minute soutenue comptant double : la règle des points cardio de Google Fit et des minutes intensives de Garmin, qui utilisent la fréquence cardiaque ; ici, seulement les pas (le vélo et la natation ne comptent pas).

Ces chiffres sont calculés à la volée à partir des pas minute par minute de Santé Connect, pour aujourd'hui. Pour des **histogrammes** (jours actifs, semaines par rapport aux 150 de l'OMS) sur 7 jours, 30 jours et un an, il faut les conserver : Santé Connect ne donne pas un historique illimité, et le client web (ADR 0008) n'a pas accès à Santé Connect. La base garde déjà les pas par jour (`daily_steps`).

## Options étudiées

### Option A — Calculer à la volée, sans base

- ✅ Rien à changer au serveur ni aux formulaires Google.
- ❌ Limité à ce que Santé Connect fournit (30 jours environ avant l'autorisation, lecture minute par minute coûteuse sur un an) ; rien sur le web.

### Option B — Envoyer les pas minute par minute au serveur

- ✅ Le serveur peut tout recalculer, et changer les seuils plus tard.
- ❌ 1 440 valeurs par jour et par personne : une donnée de santé bien plus fine que le total du jour, à justifier, protéger et déclarer ; volume inutile pour des histogrammes.

### Option C — Envoyer trois totaux par jour, calculés sur le téléphone

- ✅ Trois nombres de plus par jour, à côté du total de pas : même nature de donnée, même chemin (`POST /api/me/steps`), même suppression avec le compte.
- ✅ Compatible avec les anciennes versions de l'application : les champs sont facultatifs.
- ❌ Le calcul existe deux fois, en TypeScript (synchronisation au premier plan) et en Kotlin (travailleur de l'ADR 0009) : il faut garantir qu'ils donnent le même résultat.
- ❌ Changer un seuil ne corrige pas les jours déjà envoyés au-delà des 30 derniers.

## Décision

**Option C.**

### Base de données

Migration `006_daily_activity.sql` : trois colonnes facultatives dans `daily_steps`.

```sql
ALTER TABLE daily_steps
    ADD COLUMN active_minutes      smallint,
    ADD COLUMN very_active_minutes smallint,
    ADD COLUMN inactive_minutes    smallint;
```

`NULL` signifie « pas calculé » (jour envoyé par une ancienne version, ou par le web) et s'affiche comme une absence de donnée, pas comme zéro. Le score n'est pas stocké : il se déduit (`active + 2 × very_active`), et une autre pondération ne demanderait pas de migration.

### API

`POST /api/me/steps` accepte, pour chaque jour, trois champs facultatifs : `activeMinutes`, `veryActiveMinutes`, `inactiveMinutes`, entiers de 0 à 1 440, et `activeMinutes + veryActiveMinutes` au plus 1 440.

Règle de mise à jour : le serveur garde aujourd'hui le plus grand total de pas du jour. Les minutes suivent le même envoi : elles sont remplacées quand le total reçu est **supérieur ou égal** au total enregistré (les pas arrivés plus tard, une montre synchronisée en retard par exemple, peuvent faire baisser les minutes inactives sans changer le total). Un envoi sans les champs ne les efface pas.

`GET /api/me/steps` (et ce qu'utilise le client web) renvoie les trois champs, `null` compris.

### Calcul sur le téléphone

- **Une seule définition**, écrite dans ce document et dans `services/activity.ts` et `services/inactivity.ts`, reprise en Kotlin dans `modules/step-sync` (`ActivityCalculator.kt`).
- **Jeux d'essai partagés** : un fichier JSON de journées (minutes de pas → résultats attendus), lu par les tests TypeScript et par les tests unitaires Kotlin. Un seuil changé d'un seul côté fait échouer les tests.
- **Coût** : la lecture minute par minute (1 440 valeurs par jour) est faite pour **les 3 derniers jours** à chaque synchronisation, au premier plan comme en arrière-plan ; les jours plus anciens ne changent pratiquement plus et gardent leurs valeurs. « Synchroniser maintenant » recalcule les 30 jours. À mesurer sur le Pixel avant de figer ces chiffres.
- Jour en cours : les minutes inactives ne comptent qu'entre le premier et le dernier pas ; elles peuvent donc augmenter au fil de la journée.

### Affichage

- Statistiques 7 jours et 30 jours : un histogramme du score par jour, sous celui des pas ; un jour sans donnée n'a pas de barre.
- Statistiques 1 an : le score par **semaine**, avec la ligne des 150 de l'OMS ; une semaine qui l'atteint est en bleu plein (même règle que les barres de pas).
- 1 jour : inchangé (calculé à la volée, plus précis que la valeur envoyée).

### Confidentialité

- **Visibles par l'utilisateur seul.** Le classement et les amis ne voient que les pas, comme aujourd'hui. Les montrer aux amis serait une autre décision.
- Supprimés avec le compte (`ON DELETE CASCADE` déjà en place).
- **Politique de confidentialité** (site) : ajouter les minutes actives, très actives et inactives, calculées à partir des pas, à la liste des données envoyées.
- **Formulaire Data safety** de la Play Console : même catégorie que les pas (Santé et remise en forme → informations sur la remise en forme), même finalité (fonctionnalités de l'application) ; vérifier qu'aucune case ne change.
- **Santé Connect** : aucune nouvelle autorisation (`READ_STEPS` et `READ_HEALTH_DATA_IN_BACKGROUND` déjà acceptées).

## Conséquences

- ✅ Historique des minutes actives sur un an, sur Android et sur le web, avec la règle de l'OMS.
- ✅ Rien de nouveau à demander à l'utilisateur ni à Google.
- ⚠️ Deux implémentations du calcul, tenues identiques par les jeux d'essai partagés.
- ⚠️ Les jours envoyés avant cette version n'ont pas de minutes : les histogrammes commencent à la mise à jour (30 jours rattrapés au premier « Synchroniser maintenant »).
- ⚠️ Les pas seuls sous-estiment l'activité (vélo, natation, musculation) : à dire dans l'écran.

## Hors de cette décision

- Montrer les minutes ou le score aux amis, ou un classement par score.
- La fréquence cardiaque (nouvelle autorisation Santé Connect).
- L'historique complet des pas au-delà de 30 jours (ADR à venir).
