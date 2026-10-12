# Radar Trades

Application Android qui scanne les contrats crypto USDT de Binance Futures, propose des setups (tendance, zone d'entrée,
stop, objectifs, taille de position), suit les trades pris et affiche le portefeuille.

## Ce que valent les signaux

Le moteur a été rejoué bougie par bougie sur 11 mois de données Binance (novembre 2025 à octobre 2026, 60 contrats les plus
échangés), frais et glissement compris. R est la somme risquée sur un trade.

| Un setup est « Prêt » quand                | Setups | Gagnants | Résultat moyen | Nov. à mai | Juin à oct. |
|--------------------------------------------|-------:|---------:|---------------:|-----------:|------------:|
| les 6 contrôles sont validés (par défaut)  |  2 469 |     36 % |        +0,02 R |    +0,09 R |     −0,10 R |
| tendance, zone, déclencheur, risque        |  6 905 |     34 % |        −0,04 R |    −0,02 R |     −0,08 R |
| tendance, zone, risque                     |  8 739 |     34 % |        −0,04 R |    −0,03 R |     −0,07 R |

Aucun réglage n'a été gagnant de façon durable, et aucun des quelque 90 critères essayés (force de tendance, structure,
Bitcoin, confluences, déclencheurs 15 minutes, volume, positionnement) n'a amélioré les résultats sur une période qu'il
n'avait pas servi à choisir. Les contrôles décrivent une configuration : ils ne prédisent pas le marché.

Le dossier `tools/backtest` contient les scripts qui ont produit ces chiffres ; `tools/engine.js` est le moteur, copié dans
la page de l'appli par `node tools/inject.js`.

## Données et clés

L'appli lit les données de marché publiques de Binance. L'onglet Portefeuille demande des clés API **en lecture seule** :
elles sont chiffrées sur le téléphone et ne servent qu'à des demandes de consultation. L'appli ne passe aucun ordre.

## Installer

Télécharge `radar-trades.apk` depuis la dernière version : https://github.com/aminebenkhadra-dotcom/radar-trades/releases/latest

Chaque modification poussée sur `main` recompile l'APK automatiquement (onglet Actions).
