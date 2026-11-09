# Radar BTC·ETH

Appli Android séparée de Radar Trades (paquet `com.amine.radarbtceth`), centrée sur Bitcoin et Ether. Pour chacune, elle propose
les configurations de trade du moment : jusqu'à deux zones 4H en long sous le prix et deux en short au-dessus, chacune avec
entrée, stop, TP1, TP2, gain/risque, taille de position selon le profil (capital, risque %, levier, marge max) et son taux passé.

- **Configurations** : les huit de l'Analyser de Radar Trades (support/résistance 4H, ancien niveau qui a changé de côté,
  order block, order block + niveau). Moteur : `tools/btceth/configs.js`, construit sur `tools/engine.js`.
- **Statuts** : Prêt (tendance 4H dans le sens, 1J pas contre, prix dans la zone, gain/risque net ≥ 1,5, pas de niveau 4H avant 1R),
  Attendre le prix, Tendance mitigée, Contre-tendance, Écartée. Les signaux 15 minutes sont affichés sans être exigés.
- **Alertes** : en arrière-plan toutes les 15 minutes, quand une configuration devient « Prêt » (et, en option, quand le prix
  arrive à 0,3 % d'une zone). Jamais deux fois la même zone en 12 h.
- **Données** : prix publics de Binance Futures (BTCUSDT, ETHUSDT) uniquement. Aucune clé API, aucun ordre.

## Plan de trading (9 novembre 2026)

- **Profil** : capital 760 USDT, risque 5 % par trade, levier x10 au plus (le champ ne monte plus au-dessus), marge isolée.
  Appliqué une fois par-dessus un profil déjà enregistré ; les alertes sont conservées.
- **Stop** : au-delà de la zone d'au moins 0,4 % du prix et d'une bougie 15 minutes moyenne (ATR 15 min), jamais moins que
  0,5 ATR 4H. La taille s'adapte pour garder la même perte en dollars.
- **Filtres** : gain/risque au TP2 d'au moins 3 ; pas de « Prêt » juste après un mouvement de plus de 3 % sur les deux
  dernières bougies 15 minutes (on attend un retest).
- **Sorties** : chaque carte donne les quantités TP1 40 %, TP2 30 % et runner 30 %, avec le rappel de remonter le stop au prix
  d'entrée après le TP1.
- **Ma journée** : le résultat de chaque trade fermé met à jour le capital ; après 2 trades perdants dans la journée, les
  configurations passent en « Stop du jour » et les alertes « Prêt » s'arrêtent. Bandeaux à l'objectif (1 300 USDT : passer
  en spot) et au plancher (500 USDT : arrêter les futures).
- Ces règles ne s'appliquent qu'à l'écran et aux alertes (`BE_PLAN`) ; le rejeu garde le moteur d'origine, donc les taux
  affichés restent ceux du stop d'origine.

## Ce que valent les configurations

`tools/btceth/replay.js` rejoue le moteur sur l'historique 15 minutes (branche `btceth-data`, workflow `btceth-data.yml`) :
à chaque contact d'une zone jouable, entrée à la clôture, suivi jusqu'au TP1 ou au stop (stop d'abord si les deux sont dans
la même bougie, sortie à 10 jours), frais et glissement compris. Résultats : `tools/btceth/results/replay-v1.json`.

| Au contact d'une zone | Oct. 2024 à oct. 2025 | Oct. 2025 à oct. 2026 |
|---|---|---|
| BTC, dans la tendance | 104 · 39 % · +0,10 R | 124 · 38 % · +0,06 R |
| BTC, tendance mitigée | 129 · 33 % · −0,11 R | 125 · 36 % · −0,02 R |
| BTC, contre la tendance | 76 · 33 % · −0,09 R | 101 · 34 % · −0,10 R |
| ETH, dans la tendance | 120 · 38 % · +0,06 R | 129 · 33 % · −0,07 R |
| ETH, tendance mitigée | 131 · 33 % · −0,09 R | 129 · 30 % · −0,18 R |
| ETH, contre la tendance | 104 · 36 % · +0,05 R | 112 · 33 % · −0,09 R |

Seul BTC dans la tendance est resté au-dessus de zéro les deux années, avec un écart trop petit pour être sûr (environ ±0,1 R
d'incertitude sur ces nombres de trades). Le signal 15 minutes n'a rien ajouté. Ce sont des fréquences passées, pas une prévision.

## Construire

`node tools/btceth/build.js` assemble `btceth/page.html`, le moteur et le résumé du rejeu dans `btceth/src/main/assets/index.html`.
Tests : `node tests/btceth/engine.js` (moteur) et `node tests/btceth/run.js <dossier btceth-data>` (page dans Chromium, données réelles).
Chaque push sur `main` qui touche l'appli lance `btceth-build.yml` : release `btceth-v<n>` avec `radar-btc-eth.apk`.
