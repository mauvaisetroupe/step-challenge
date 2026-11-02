# Préparer les captures d'écran des boutiques

Les captures du Play Store et d'AppGallery se font sur la base de **développement**, remplie de données fictives :
jamais de données réelles de testeurs (dépôt public, et fiche publique). Les sources sont rangées dans
`docs/screenshots/`.

## Remplir la base de dev

`npm run seed:demo` (dans `backend/`) écrit dans la base de dev des amis fictifs et des historiques de pas pour un
compte (ADR 0006). Il refuse toute base qui n'est pas locale et nommée `*_dev`.

```bash
cd backend
npm run seed:demo                                        # liste les comptes de la base de dev
npm run seed:demo -- --user <id>                         # 6 amis fictifs pour ce compte, 42 jours de pas
npm run seed:demo -- --user <id> --own-steps --days 120  # et ses propres pas (statistiques)
npm run seed:demo -- --demo                              # le compte de démonstration lui-même
```

Relancer la commande rafraîchit les données (les pas du jour suivent l'heure).

## Faire les captures

1. Lancer le backend de dev et l'application de développement ([Développer en local](../tutorials/develop-locally.md)).
2. Se connecter avec le compte rempli.
3. Les pas propres du compte restent synchronisés par Santé Connect, qui garde le maximum par jour : faire les
   captures sur un téléphone ou un émulateur **sans pas réels**, ou désactiver la synchronisation.
4. Captures dans les deux langues (Paramètres › Langue), rangées dans `docs/screenshots/<langue>/`.

## Les envoyer

- Play Console › Développer sa présence › Présence sur le Store › Fiche principale (par langue).
- AppGallery Connect › App information › Localization › Visual assets (obligatoires pour chaque langue).
