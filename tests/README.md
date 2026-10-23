# Tests de la version 42

| Fichier | Ce qu'il vérifie | Commande |
|---|---|---|
| `run.js` | Les cas de recette de la note du 23 octobre 2026 et d'autres : taille nette de frais, plafond de marge, levier et liquidation, plafonds du compte, prix sur le pas du contrat, couverture des stops, quatre statuts, spread et obstacle, données absentes, statut final, résultat net, frais en BNB, historique paginé, suivi sans argent, moteur complet | `node tests/run.js` (code de `tools/`) et `node tests/run.js --page` (code copié dans la page) |
| `page/run.js` | La vraie page dans Chromium, téléphone et Binance simulés : scan, détail d'un setup, profil, stop partiel, protection inconnue, résultats paginés, alertes en arrière-plan, sauvegarde, clé capable de trader | `NODE_PATH=<dossier de playwright> node tests/page/run.js` |
| `compare.js` | Avant / après : les mêmes cas sur le code de la version 41 (extrait de sa page) et sur celui de la version 42 | `node tests/compare.js <index.html de la V41>` |
| `apk_sigs.py` | Les certificats d'un APK (v2, v3, lineage) sans outil Android | `python3 tests/apk_sigs.py radar-trades.apk` |

`run.js` et la vérification `node tools/inject.js --check` (moteur et calculs identiques dans `tools/` et dans la page) tournent
avant chaque compilation : un échec arrête le build, rien n'est publié.

La page de la version 41 se trouve dans l'APK V41 (`assets/index.html`) ou dans git (`git show v45:app/src/main/assets/index.html`).
