# Badges, points et niveaux

Spécification fonctionnelle. **Statut : brouillon (2026-11-02)**, questions tranchées, à valider avant l'implémentation.

Inspiré du système de Garmin Connect : chaque badge rapporte des points, les points s'additionnent, et le total donne un niveau, de plus en plus long à atteindre. Tout est automatique : aucun administrateur ne crée ni n'attribue de badge.

## Vocabulaire

| Terme | Définition |
|---|---|
| **Objectif du jour** | 10 000 pas, l'objectif fixe de l'application (anneau de l'Accueil, séries). |
| **Jour réussi** | Jour dont le total en base atteint l'objectif. Un jour absent de la base n'est pas réussi. |
| **Série** | Jours réussis consécutifs, comme la carte « Série » de l'Accueil. |
| **Semaine** | Du lundi au dimanche, comme le classement. |
| **Mois** | Mois civil. |
| **Fuseau** | Celui du serveur (`APP_TIMEZONE`), comme le classement. |
| **Période définitive** | Une semaine ou un mois terminé depuis au moins 2 jours : les pas du dernier jour sont arrivés (même règle que la mention « Résultat provisoire » du Classement). |

## Trois sortes de badges

| Sorte | Obtenu | Exemple | Identifié par |
|---|---|---|---|
| **Unique** | Une seule fois dans la vie du compte | « 20 000 pas en un jour » | le badge seul |
| **De période** | Une fois par semaine ou par mois | « Novembre 2026 : 300 000 pas » | le badge et la période (`2026-11`, `2026-W45`) |
| **Répétable** | Plusieurs fois, sans limite | « Série de 30 jours », gagnée à chaque bloc de 30 jours | le badge et un numéro d'occurrence (n° 1, n° 2…) |

Les badges de période **n'ont pas à être créés** : ceux de novembre existent dès le 1ᵉʳ novembre, déduits du calendrier. Le catalogue décrit des modèles (« N pas dans le mois ») ; le mois en cours les rend concrets.

Chaque seuil est un badge à part : 20 000 pas en un jour donne aussi le badge des 15 000, et les points s'additionnent.

## Catalogue de départ

Points de 1 à 4. Les seuils sont des propositions, à ajuster après un essai sur les données de développement.

### Pas en un jour (unique)

| Badge | Pas en un jour | Points |
|---|---|---|
| 15 000 en un jour | 15 000 | 1 |
| 20 000 en un jour | 20 000 | 1 |
| 25 000 en un jour | 25 000 | 2 |
| 30 000 en un jour | 30 000 | 2 |
| 40 000 en un jour | 40 000 | 3 |
| 50 000 en un jour | 50 000 | 4 |

### Semaine (de période, chaque semaine)

| Badge | Condition | Points |
|---|---|---|
| Semaine à l'objectif | 70 000 pas dans la semaine (10 000 en moyenne) | 1 |
| Grosse semaine | 100 000 pas dans la semaine | 2 |
| Semaine active | Score d'activité de la semaine ≥ 150, la recommandation de l'OMS ([ADR 0010](../adr/0010-daily-activity-minutes.md)) ; seulement pour les jours dont les minutes ont été envoyées | 1 |

### Mois (de période, chaque mois)

| Badge | Condition | Points |
|---|---|---|
| Mois à 300 000 | 300 000 pas dans le mois | 1 |
| Mois à 400 000 | 400 000 pas dans le mois | 1 |
| Mois à 500 000 | 500 000 pas dans le mois | 2 |
| Mois régulier | 20 jours réussis dans le mois | 2 |
| Mois parfait | Tous les jours du mois réussis | 4 |
| Défi du mois | Un défi différent chaque mois, voir ci-dessous | 2 |

**Défi du mois** : la liste ci-dessous tourne, un défi par mois, dans l'ordre (le même pour tout le monde, sans intervention). Avec N défis, chacun revient tous les N mois ; en ajouter un allonge simplement le cycle.

- 5 jours à 15 000 pas ;
- 4 semaines actives (OMS) ;
- 8 jours de week-end réussis ;
- une série de 14 jours commencée dans le mois ;
- 3 jours à 20 000 pas ;
- 1 journée non sédentaire (voir ci-dessous).

Le nom du badge porte le mois : « Défi de novembre 2026 ».

### Séries

**Séries (unique)** : mêmes repères que la frise de l'Accueil, pour que l'Accueil et les badges parlent le même langage.

| Série | 7 | 14 | 30 | 60 | 100 | 200 | 365 |
|---|---|---|---|---|---|---|---|
| Points | 1 | 1 | 2 | 2 | 3 | 3 | 4 |

**Séries répétables** (comme Garmin) :

| Badge | Condition | Points à chaque occurrence |
|---|---|---|
| Série de 30 jours | Chaque bloc de 30 jours réussis consécutifs | 3 |
| Série de 60 jours | Chaque bloc de 60 jours réussis consécutifs | 4 |

Pas de plafond. Ce sont les badges les mieux payés à durée égale : un seul jour manqué casse la série, quand les badges de semaine et de mois tolèrent des jours de repos. Avec le cumul ci-dessous, 60 jours sans interruption rapportent 3 + 3 + 4 = 10 points.

**Règle de comptage** (elle compte des blocs, pas des dates) :

- nombre d'occurrences dues = somme, sur toutes les séries de l'historique, de ⌊longueur ÷ 30⌋ (÷ 60 pour l'autre badge) ;
- les occurrences déjà obtenues ne sont jamais retirées ; on attribue celles qui manquent ;
- une occurrence est gagnée le jour où le bloc est complet, sans attendre la fin de la série ;
- les deux badges se cumulent : chacun compte ses propres blocs, et une série de 60 jours donne 2 × « Série de 30 jours » et 1 × « Série de 60 jours ».

Pourquoi compter et non dater : les pas arrivent parfois en retard (montre synchronisée le lendemain). Un jour manquant qui arrive plus tard peut **fusionner** deux séries, et les dates de fin des blocs changent. Le nombre de blocs, lui, ne peut que croître : un jour réussi le reste (le serveur garde le plus grand total), et ⌊a ÷ 30⌋ + ⌊b ÷ 30⌋ ≤ ⌊(a + b + 1) ÷ 30⌋. Exemple : deux séries de 29 jours ne valent rien ; une fois réunies par le jour qui manquait, elles font 59 jours, soit une occurrence.

### Journée non sédentaire (répétable)

| Badge | Condition | Points à chaque occurrence |
|---|---|---|
| Journée non sédentaire | Un jour réussi (10 000 pas ou plus) sans aucune minute d'inactivité | 3 |

Les minutes d'inactivité sont celles de l'[ADR 0010](../adr/0010-daily-activity-minutes.md) : périodes d'au moins 60 minutes sans marche, entre le premier et le dernier pas, hors heures de sommeil. Règles :

- seulement pour un **jour terminé** : le jour en cours peut encore accumuler de l'inactivité ;
- seulement si les minutes ont été envoyées pour ce jour (une ancienne version de l'application ou le web n'en envoient pas) ;
- le jour doit être réussi : un jour sans pas, ou presque, n'a aucune minute d'inactivité sans être actif pour autant.

Gagnée à chaque journée, sans limite : c'est rare. Mesuré sur la production le 2026-11-02 (9 personnes, 60 jours) : 1 journée non sédentaire sur 198 jours réussis, environ 0,5 %. Plus rare qu'une série de 30 jours, d'où le même nombre de points ; le maximum de 4 reste aux efforts longs (série de 60 jours, mois parfait).

Le défi du mois « 1 journée non sédentaire » reprend la même définition.

### Cumul (unique)

| Badge | Pas depuis l'arrivée sur Step Challenge | Points |
|---|---|---|
| 1 million de pas | 1 000 000 | 1 |
| 2,5 millions de pas | 2 500 000 | 1 |
| 5 millions de pas | 5 000 000 | 2 |
| 10 millions de pas | 10 000 000 | 3 |
| 25 millions de pas | 25 000 000 | 4 |

### Classement entre amis (de période)

| Badge | Condition | Points |
|---|---|---|
| Vainqueur de la semaine | 1ᵉʳ du classement de la semaine | 2 |
| Podium de la semaine | 2ᵉ ou 3ᵉ de la semaine | 1 |
| Vainqueur du mois | 1ᵉʳ du classement du mois | 3 |
| Podium du mois | 2ᵉ ou 3ᵉ du mois | 2 |

Règles :

- attribué **une fois la période définitive** (fin + 2 jours), jamais pendant ;
- même classement que l'écran Classement : les amis au moment de l'attribution, les ex æquo partagent le rang (deux premiers ex æquo gagnent tous deux) ;
- **au moins 3 participants** ayant des pas dans la période, moi compris : sans cela, être premier avec un seul ami serait trop facile ;
- un **nouveau venu** de la période (marqué `newcomer` par le classement, hors concours) ne gagne pas de badge de classement et ne compte pas parmi les 3 participants ;
- un badge obtenu reste acquis, même si l'ami est retiré ou bloqué ensuite.

## Points et niveaux

- **Total** : somme des points de tous les badges obtenus. Les points sont **figés à l'obtention** : rééquilibrer le catalogue plus tard ne change pas ce qui est acquis.
- **Niveau** : déduit du total par une courbe, jamais stocké, donc réglable sans toucher aux données. Proposition : seuil du niveau n = arrondi de 4 × (n − 1)^1,8.

| Niveau | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 15 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | 0 | 4 | 14 | 29 | 49 | 72 | 101 | 133 | 169 | 209 | 300 | 462 | 801 |

Pas de niveau maximum.

**Calibrage**, à vérifier sur les données de développement :

- une personne qui marche ses 10 000 pas presque tous les jours, avec des jours de repos, gagne environ 10 à 15 points par mois (4 semaines à l'objectif, un mois à 300 000, quelques semaines actives, un peu de classement), plus une vingtaine de points uniques les premiers mois : niveau 5 en 3 à 4 mois, niveau 10 vers 18 mois, niveau 15 vers 3 ans ;
- une personne qui ne manque aucun jour gagne en plus environ 9 points par mois : 5 avec les séries répétables (3 par bloc de 30 jours, 4 par bloc de 60) et 4 avec le mois parfait ; niveau 10 vers 9 à 10 mois.

## Ce que voit l'utilisateur

- **Niveau, total de points** et progression vers le niveau suivant (« 12 points avant le niveau 6 »).
- **Badges obtenus**, du plus récent au plus ancien ; un répétable affiché une fois, avec son nombre (« × 7 »).
- **Badges du mois en cours** et de la semaine, avec leur progression (« 214 000 / 300 000 pas »), pour donner un but.
- **Badges uniques pas encore obtenus**, avec leur condition.
- **Nouveau badge** : annoncé dans l'application à la première ouverture qui suit son obtention (pas de notification système dans cette première version).

Textes en français et en anglais. Le nom d'un badge de période porte sa période (« Novembre 2026 : 300 000 pas », « Vainqueur de la semaine du 26 octobre »).

## Règles générales

- **Attribution automatique**, sans administrateur : à chaque envoi de pas (application ou synchronisation en arrière-plan) et à l'ouverture de l'écran des badges.
- **Rien n'est retiré** : un badge obtenu le reste, même si les données changent ensuite.
- **Confiance** : les badges reposent sur les pas envoyés par le téléphone, comme le classement ; la limite de 100 000 pas par jour s'applique.
- **Suppression du compte** : les badges sont supprimés avec lui.
- **Compte de démonstration** (ADR 0006) : il gagne des badges comme un autre compte, à partir de ses pas fictifs.
- **Visibilité** : le niveau et les badges sont visibles par les amis, comme les pas. Le niveau s'affiche à côté du nom dans le Classement, et les badges d'un ami se consultent depuis son entrée. Personne d'autre ne les voit : il n'y a pas de profil public.
- **Rétroactivité**, à la mise en service : les badges uniques (records, séries, cumul), les séries répétables et les journées non sédentaires sont calculés sur tout l'historique en base ; les badges de semaine et de mois, classement compris, seulement à partir du mois de mise en service. Sinon les premiers testeurs recevraient des dizaines de badges d'un coup, et les classements passés seraient recalculés avec les amis d'aujourd'hui.
