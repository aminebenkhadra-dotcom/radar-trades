# Radar Top 50

Appli Android séparée (paquet `com.amine.radartop50`). Elle analyse les 50 contrats USDT de Binance Futures qui ont le plus de volume
sur 24 h (cryptos seulement : ni stablecoin, ni or, ni action tokenisée) et montre les configurations prêtes selon **des réglages que
l'on choisit**, avec leur taux de succès sur deux ans recalculé à chaque changement.

- **Setups** : taux de la configuration active (TP touché avant le stop, R moyen, par année), setups prêts avec entrée, stop,
  objectif, taille, taux du type de zone et taux sur la crypto ; zones à moins de 2 %. Fiche par crypto : graphique 4H, tendance
  sur 5 unités de temps, toutes ses zones vues avec les réglages (et la raison quand elles en sortent).
- **Paramétrer** : 8 types de zone, sens, tendance 4H/1J, Bitcoin 4H, objectif (niveau 4H, 1R, 1,5R, 2R), gain/risque minimum,
  obstacle avant 1R, signal 15 min, Top 10/20/50. Configurations nommées et enregistrées ; quatre au départ (Tendance,
  Tendance + Bitcoin, Objectif 1R, Tout), écrites avant le rejeu.
- **Alertes** : contrôle du Top 50 toutes les 30 minutes avec la configuration active.
- Aucune clé API, aucun ordre : prix publics de Binance Futures seulement.

## Rejeu

`tools/top50/replay.js` (workflow `top50-replay.yml`) rejoue les 50 contrats les plus échangés en septembre 2026, de septembre 2024
à octobre 2026 (branche `top50-data`) : chaque contact d'une zone est noté avec tous ses paramètres et son résultat pour les quatre
objectifs, frais et glissement compris (38 959 contacts, `tools/top50/results/replay-v1.json`). L'appli filtre ces contacts selon
les réglages.

| Réglage | Oct. 2024 à oct. 2025 | Oct. 2025 à oct. 2026 |
|---|---|---|
| Tendance | 2 176 · 33 % · −0,03 R | 2 940 · 33 % · −0,05 R |
| Tendance + Bitcoin | 1 636 · 32 % · −0,07 R | 2 090 · 33 % · −0,03 R |
| Objectif 1R | 3 109 · 51 % · −0,02 R | 4 156 · 49 % · −0,06 R |
| Tout | 15 842 · 37 % · −0,02 R | 20 913 · 36 % · −0,05 R |

Sur 2 268 combinaisons de réglages essayées, 56 (2,5 %) sont positives les deux années, de +0,01 à +0,10 R : c'est ce que le hasard
seul donne avec autant d'essais. Aucun réglage ne se détache ; les taux sont des fréquences passées, pas une prévision.

## Construire

`node tools/top50/build.js` ; tests `node tests/top50/engine.js` et `node tests/top50/run.js [dossier top50-data]`.
Chaque push sur `main` qui touche l'appli lance `top50-build.yml` : release `top50-v<n>` avec `radar-top50.apk`.
