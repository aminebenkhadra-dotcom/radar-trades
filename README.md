# Radar Trades

Application Android qui scanne les contrats crypto USDT de Binance Futures, propose des setups (tendance, zone d'entrée,
stop, objectifs, taille de position), suit les trades pris et affiche le portefeuille.

- **Mes trades** lit en direct les positions ouvertes sur Binance Futures, avec leurs ordres stop et TP (y compris les ordres
  conditionnels du service « algo » de Binance), et applique les contrôles de suivi : validité, feu vert break-even, objectif,
  stop absent, stop au-delà de la liquidation, positions fermées avec leur résultat réalisé.
- **Résultats › Suivi sans argent** note chaque setup « Prêt » (ou à 95 % et plus) trouvé par un scan, manuel ou en
  arrière-plan, au prix du moment, puis regarde sur les bougies 15 minutes s'il touche d'abord le stop ou le TP1 (au plus
  5 jours), frais et glissement compris. Le résultat est donné en R : on juge les signaux en direct avant d'y mettre de l'argent.
- **Earn** compare pour une crypto les offres Binance (Flexible, Bloqué, On-chain, Soft staking, WBETH et BNSOL), les taux
  publics d'OKX et les pools DeFi suivis par DefiLlama, calcule ce que rapporteraient les avoirs du portefeuille (hors marge
  Futures) et explique la marche à suivre.
- **Cycle** situe le marché dans le cycle de 4 ans et donne la saison des altcoins : part des 50 plus grosses altcoins qui font
  mieux que le Bitcoin sur 90 jours, part du Bitcoin, ETH/BTC.

## Ce que valent les signaux

Le moteur a été rejoué bougie par bougie sur deux années séparées de données Binance, chacune sur la soixantaine de contrats
les plus échangés au début de l'année, frais et glissement compris. L'année 2024-2025 n'a servi à aucun réglage : c'est le
test le plus honnête. R est la somme risquée sur un trade.

| Un setup est « Prêt » quand                | Oct. 2024 à oct. 2025               | Nov. 2025 à oct. 2026              |
|--------------------------------------------|-------------------------------------|------------------------------------|
| les 6 contrôles sont validés (par défaut)  | 3 347 setups · 32 % · −0,08 R       | 2 469 setups · 36 % · +0,02 R      |
| tendance, zone, déclencheur, risque        | 9 193 setups · 34 % · −0,03 R       | 6 905 setups · 34 % · −0,04 R      |
| tendance, zone, risque                     | 11 565 setups · 35 % · −0,01 R      | 8 739 setups · 34 % · −0,04 R      |

Aucun réglage n'a été gagnant de façon durable. Aucun des quelque 90 critères essayés (force de tendance, structure,
Bitcoin, confluences, déclencheurs 15 minutes, volume, positionnement) n'a amélioré les résultats sur une période qu'il
n'avait pas servi à choisir. Ne prendre que les setups dans le sens de la tendance du marché (onglet Tendance) a aidé en
2025-2026 (+0,05 R par trade) et nui en 2024-2025 (−0,11 R). Un objectif à 1R rend un trade sur deux gagnant sans changer
le résultat moyen. Les contrôles décrivent une configuration : ils ne prédisent pas le marché.

Le dossier `tools/backtest` contient les scripts qui ont produit ces chiffres ; `tools/engine.js` est le moteur, copié dans
la page de l'appli par `node tools/inject.js`.

## Données et clés

L'appli lit les données de marché publiques de Binance. L'onglet Portefeuille demande des clés API **en lecture seule** :
elles sont chiffrées sur le téléphone et ne servent qu'à des demandes de consultation fixées dans `Exchanges.java`
(soldes, positions, ordres ouverts, résultats, offres Earn). L'appli ne passe, ne modifie et n'annule aucun ordre.

## Installer

Télécharge `radar-trades.apk` depuis la dernière version : https://github.com/aminebenkhadra-dotcom/radar-trades/releases/latest

Chaque modification poussée sur `main` recompile l'APK automatiquement (onglet Actions).
