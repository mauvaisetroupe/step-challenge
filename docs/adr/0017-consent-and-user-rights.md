# ADR 0017 — Accord explicite, trace des autorisations et droits des utilisateurs

- **Statut** : Accepté
- **Date** : 2026-11-26
- **Décideur** : mauvaisetroupe
- **Lié à** : [ADR 0001 — Authentification](0001-authentication.md) (création du compte), [ADR 0004 — Signalement et blocage](0004-user-reporting-and-blocking.md) (conditions d'utilisation), [ADR 0012 — Compatibilité de l'API](0012-api-backward-compatibility.md), [ADR 0013 — Choix de la source des pas](0013-step-source-choice.md) (retrait de HUAWEI Health), [ADR 0016 — HUAWEI Health par le serveur](0016-huawei-health-through-the-server.md) (proposé, non retenu pour l'instant)

## Contexte

La vérification de Health Service Kit juge la conformité de l'application sur une check-list ([Vérification Huawei](../reference/huawei-verification.md), onglet « Privacy Compliance Checklist »). Quatre points ne sont pas remplis :

| Point de la check-list | Aujourd'hui |
|---|---|
| **Information au premier usage** : afficher la politique de confidentialité et les conditions, et redemander l'accord quand elles changent. | Une phrase « En créant ton compte, tu acceptes les conditions d'utilisation » sous le bouton de création du compte. Rien sur la politique de confidentialité, aucun nouvel accord après un changement. |
| **Refus** : sans accord, pas d'accès au service. | Pas d'accord explicite, donc pas de refus possible. |
| **Traçabilité** : le serveur garde une trace de chaque autorisation accordée ou retirée. | Le serveur ne sait rien de l'autorisation HUAWEI : elle se passe entre le téléphone et HUAWEI (ADR 0013). |
| **Droit d'accès** : une entrée pour exporter toutes ses données personnelles. | Pas d'export. |
| **Droit de modifier** : après le retrait de l'autorisation, l'historique est gardé ou supprimé selon le choix de l'utilisateur. | Le retrait garde les pas jusqu'à la suppression du compte, sans proposer de choix. |

Ces exigences valent au-delà de Huawei : ce sont celles du RGPD (articles 7, 15 et 17) pour une application qui traite des données d'activité physique.

Contraintes :

- **Compatibilité de l'API** (ADR 0012) : les anciennes versions de l'application et le travailleur Kotlin (ADR 0009) appellent l'API sans connaître ces nouveautés, et une mise à jour n'est jamais obligatoire.
- La politique et les conditions sont publiées sur le site public (`architech-sport`, ADR 0014), un autre dépôt : le serveur ne peut pas savoir seul qu'elles ont changé.
- Le compte est créé par la requête de connexion, qui porte le nom choisi (`signInWithOidc`, ADR 0001).

## Options étudiées

### Où vérifier l'accord

**Option A — Le serveur refuse les requêtes d'un utilisateur sans accord à jour** (réponse 403 sur toutes les routes sauf l'accord, l'export et la suppression du compte).

- ✅ Le refus est garanti, quel que soit le client.
- ❌ Casse les anciennes versions de l'application et le travailleur Kotlin, qui ne savent pas afficher l'écran d'accord : leurs utilisateurs perdent la synchronisation sans comprendre pourquoi (contraire à l'ADR 0012).

**Option B — L'application bloque, le serveur informe.** Le serveur dit quels documents restent à accepter ; l'application affiche un écran d'accord bloquant ; le serveur enregistre l'accord.

- ✅ Aucune rupture : les anciennes versions continuent comme avant, l'accord est demandé à la mise à jour.
- ✅ C'est ce que Huawei examine : la version publiée sur AppGallery, filmée.
- ❌ Une ancienne version, ou un client modifié, peut se passer de l'accord. Acceptable : l'application est open source, et l'accord donné à la création du compte reste valable pour l'ancienne version.

### Trace des autorisations HUAWEI

**Option C — Le serveur fait l'autorisation (ADR 0016).** Trace exacte, mais un chantier lourd, laissé à l'état Proposé.

**Option D — L'application déclare ce qu'elle constate.** Après une autorisation réussie, un retrait dans l'application, ou un refus constaté (autorisation retirée dans HUAWEI Health, interrupteur coupé), elle l'envoie au serveur, qui l'inscrit dans un journal.

- ✅ Une route et une table ; aucun jeton HUAWEI sur le serveur.
- ❌ Un retrait fait dans HUAWEI Health n'est connu qu'à l'ouverture suivante de Step Challenge. Huawei ne demande pas plus : son scénario 3.3 se joue aussi « à l'ouverture suivante ».

### Suppression de l'historique au retrait

**Option E — Une colonne `source` sur les pas,** pour ne supprimer que ceux venus de HUAWEI Health.

- ❌ Les anciennes versions n'envoient pas de source : les pas déjà enregistrés n'en ont pas. Et un jour lu dans les deux sources n'a qu'une ligne.

**Option F — Supprimer tous les pas enregistrés,** en le disant clairement.

- ✅ Simple et sans ambiguïté pour l'utilisateur : « tes pas enregistrés dans Step Challenge ».
- ❌ Les pas venus de Santé Connect partent aussi. Ils reviennent en partie : la source suivante renvoie ses 30 derniers jours.

## Décision

Options **B**, **D** et **F**.

### Un journal des accords

Une table, en ajout seul :

```sql
CREATE TABLE user_consents (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subject    text        NOT NULL,  -- 'terms', 'privacy', 'huawei_health'
    action     text        NOT NULL,  -- 'granted', 'withdrawn'
    version    text,                  -- version du document accepté
    detail     jsonb,                 -- scopes HUAWEI, cause d'un retrait
    created_at timestamptz NOT NULL DEFAULT now()
);
```

- L'état courant d'un sujet est sa dernière ligne ; l'historique reste.
- Aucune donnée de santé : le sujet, l'action, une version, des scopes.
- Gardé tant que le compte existe : la suppression du compte l'efface (`ON DELETE CASCADE`), comme le reste. Les sauvegardes le gardent 7 jours de plus (politique de confidentialité, section 6).

### Versions des documents

- Le backend porte les versions en vigueur, dans le code (`backend/src/legal.ts`) : la date de la dernière modification **de fond** de chaque document, par exemple `{ terms: '2026-10-05', privacy: '2026-11-26' }`. Une correction de forme ne change pas la version.
- Modifier le fond d'un document sur le site public, c'est aussi changer sa version ici et publier l'API. La page [Mettre à jour le site public](../how-to/update-the-public-site.md) le dira.
- Les comptes existants n'ont aucune ligne : ils sont traités comme n'ayant rien accepté, et l'écran d'accord s'affiche à la mise à jour. La phrase de création du compte n'était pas un accord explicite.

### Accord au premier usage, et à chaque changement

- **API** :
  - `GET /api/me` ajoute `pendingConsents` : les documents dont la version en vigueur n'est pas acceptée, par exemple `[{ "document": "privacy", "version": "2026-11-26" }]`. Ajout seul (ADR 0012).
  - `POST /api/me/consents` enregistre les accords : `{ "consents": [{ "subject": "privacy", "action": "granted", "version": "2026-11-26" }] }`. Une version qui n'est pas celle en vigueur est refusée (409) : le document a changé pendant la lecture.
  - La requête de connexion qui crée le compte accepte un champ optionnel `acceptedLegal` (les versions vues) : l'accord est inscrit dans la même transaction que le compte.
- **Application** :
  - À la **création du compte**, l'écran du nom remplace la phrase actuelle par une case à cocher, décochée : « J'accepte les conditions d'utilisation et la politique de confidentialité » (les deux en liens). Le bouton reste inactif tant qu'elle n'est pas cochée.
  - À **chaque ouverture**, si `pendingConsents` n'est pas vide, un écran bloquant : ce qui a changé (« La politique de confidentialité a été mise à jour »), les liens, et deux boutons : **J'accepte** et **Refuser**.
  - **Refuser** explique que Step Challenge ne peut pas fonctionner sans cet accord, et propose deux sorties : se déconnecter, ou supprimer le compte (le chemin existant). Rien d'autre n'est accessible : c'est le point « Refus » de la check-list.
  - Hors ligne, l'écran ne s'affiche pas : il attend la prochaine réponse de `GET /api/me`.
- **Serveur** : il ne refuse aucune requête faute d'accord (option B). Le travailleur Kotlin continue d'envoyer les pas.

### Trace des autorisations HUAWEI

- L'application envoie, par `POST /api/me/consents`, avec le sujet `huawei_health` :
  - `granted` après une connexion réussie, avec les scopes accordés dans `detail`, **seulement s'ils ont changé** depuis le dernier envoi (mémorisés sur le téléphone) : la connexion a lieu à chaque lecture, le journal ne doit pas en garder trace ;
  - `withdrawn` après un retrait dans l'application (`detail.cause: 'app'`), ou quand elle constate un refus : `notAuthorized` (`'huawei_app'`) ou `switchOff` (`'switch'`).
- Un envoi qui échoue est retenté à l'ouverture suivante ; il ne bloque jamais la lecture des pas.
- Si l'ADR 0016 est repris un jour, le serveur écrira lui-même ces lignes, dans la même table.

### Export des données

- `GET /api/me/export` rend en JSON toutes les données personnelles de l'utilisateur :
  - le compte : nom, date de création ;
  - les identifiants de connexion : fournisseur, date de création et de dernière utilisation (ni l'identifiant Google, ni aucun secret) ;
  - les sessions : dates de création et de dernière utilisation (jamais l'empreinte du jeton) ;
  - les pas et les minutes d'activité de chaque jour ;
  - les amis (leur nom tel que l'utilisateur le voit, son surnom pour eux, la date), les invitations créées, les blocages, les signalements **faits** par l'utilisateur (pas ceux qui le visent : ils protègent celui qui signale) ;
  - les badges ;
  - le journal des accords.
- Limité à quelques appels par heure (`rateLimit.ts`). Les données tiennent en quelques centaines de kilo-octets : réponse directe, sans tâche de fond ni e-mail.
- **Application** : Plus → Compte → **Exporter mes données** : télécharge le JSON, l'écrit dans un fichier temporaire (`step-challenge-export-AAAA-MM-JJ.json`) et ouvre la feuille de partage d'Android, qui permet de l'enregistrer ou de l'envoyer.
- Les pas par heure lus dans HUAWEI Health ne sont jamais enregistrés (politique, section 3) : il n'y a rien à exporter.

### Choix de l'historique au retrait de HUAWEI Health

- La confirmation du retrait (Plus → Source des pas → Retirer l'accès à HUAWEI Health) propose deux choix :
  - **Retirer l'accès et garder mes pas** (le comportement actuel) ;
  - **Retirer l'accès et supprimer mes pas** : tous les pas et minutes d'activité enregistrés dans Step Challenge, quelle que soit leur source, le texte le dit.
- `DELETE /api/me/steps` supprime toutes les lignes de `daily_steps` de l'utilisateur. Les badges déjà gagnés restent : ce sont des récompenses, pas des données de santé. Les classements des périodes passées perdent ses pas.
- Le retrait vers Santé Connect (changement de source) garde les pas, sans choix : l'utilisateur change de source, il ne quitte pas le service. La suppression reste possible par le retrait explicite.
- Les données de HUAWEI Health dans le cloud HUAWEI ne sont pas touchées (`cancelAuthorizationAll(false)`) : Step Challenge n'en écrit aucune.

## Conséquences

- La check-list passe à ✅ sur Information au premier usage, Refus, Traçabilité, Droit d'accès et Droit de modifier.
- Une migration (`V008__user_consents.sql`), quatre routes ou champs nouveaux, tous ajoutés sans rien retirer : le contrat de l'API (ADR 0012) s'enrichit, aucune version ancienne n'est cassée.
- Tous les utilisateurs voient l'écran d'accord une fois, à la mise à jour : à annoncer dans les notes de version.
- Publier une modification de fond de la politique ou des conditions demande maintenant aussi une version de l'API. La page du site public et [Versions et livraisons](../explanation/versions-and-releases.md) le disent.
- La politique de confidentialité mentionne le journal des accords (section 3 ou 6) et l'export (section des droits) : changement de fond, donc nouvelle version, acceptée par tous à la mise à jour.
- Les pages d'aide du site décrivent l'export et le choix au retrait.

## Points ouverts

1. **Comptes de démonstration** (ADR 0006) : l'examinateur voit l'écran d'accord à chaque nouveau compte. C'est voulu (Google et Huawei filment le parcours réel), à vérifier dans les instructions d'examen.
2. **Client web** (ADR 0008) : même écran d'accord et même export, à faire quand il existera.
3. **Format de l'export** : JSON seul. Un CSV des pas serait plus utile à un utilisateur ordinaire ; à ajouter si quelqu'un le demande.
4. **Âge minimum** : ni la check-list ni cet ADR n'en traitent. Les conditions d'utilisation en parlent-elles ? À relire avec elles.
