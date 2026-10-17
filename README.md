# Radar Trades

Application Android qui scanne les contrats crypto USDT de Binance Futures, propose des setups (tendance, zone d'entrée,
stop, objectifs, taille de position), suit les trades pris et affiche le portefeuille.

- **Mes trades** lit en direct les positions ouvertes sur Binance Futures, avec leurs ordres stop et TP (y compris les ordres
  conditionnels du service « algo » de Binance), et applique les contrôles de suivi : validité, feu vert break-even, objectif,
  stop absent, stop au-delà de la liquidation, positions fermées avec leur résultat réalisé.
- **Résultats › Suivi sans argent** note chaque setup « Prêt » (ou à 95 % et plus) trouvé par un scan, manuel ou en
  arrière-plan, au prix du moment, puis regarde sur les bougies 15 minutes s'il touche d'abord le stop ou le TP1 (au plus
  5 jours), frais et glissement compris. Le résultat est donné en R : on juge les signaux en direct avant d'y mettre de l'argent.
- **Temporalité** montre le résultat des setups par jour et par heure sur les deux années de test, et l'activité de Bitcoin
  heure par heure. Le jour compte un peu : les setups du lundi et du mardi (UTC) ont fait −0,11 R contre 0,00 R les autres
  jours, les deux années. L'heure ne compte pas : aucun effet stable d'une année sur l'autre. Le réglage « Temporalité »
  (Précision des setups) signale ces jours, les écarte, ou n'en tient pas compte.
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

## Volume profile, VWAP ancrés, flux d'ordres, price action

Chaque setup affiche, sur les 5 derniers jours en 1H : le volume profile (POC, zone de valeur à 70 %), deux VWAP ancrés
(depuis le plus haut et depuis le plus bas), le delta cumulé des ordres agressifs (volume taker) avec ses divergences, et la
price action des dernières bougies 4H et 1H. Ces lectures ont été rejouées sur les setups « Prêt » des deux années :

| Lecture au moment de l'entrée | Oct. 2024 à oct. 2025 | Nov. 2025 à oct. 2026 |
|-------------------------------|-----------------------|-----------------------|
| confirme le setup (score ≥ 2) | 254 · 29 % · −0,18 R  | 277 · 38 % · +0,10 R  |
| mitigée                       | 2 143 · 33 % · −0,06 R | 1 569 · 35 % · +0,01 R |
| contredit le setup (≤ −2)     | 950 · 31 % · −0,10 R  | 623 · 35 % · +0,02 R  |

Aucun effet durable, ni ensemble ni composante par composante : ces lectures restent des aides visuelles et ne changent
pas le statut « Prêt ».

## Fiabilité et durée jusqu'au TP

La fiabilité affichée est la distance au stop divisée par la distance entre le stop et le TP. Rejouée sur 26 000 setups des
deux années, elle a prédit la part de TP atteints avant le stop à 2 points près (33 % prévus, 33 à 34 % observés). La durée
est le temps médian qu'ont mis les setups gagnants pour un TP aussi éloigné, mesuré en ATR 1H : environ 10 h pour 2 à 3 ATR,
17 h pour 3 à 4, 25 h pour 4 à 5, 34 h pour 5 à 6 (`tools/backtest/timing26.js`).

## Potentiel pour le prochain bull run

Mesuré sur le dernier cycle (`tools/backtest/cycles.js` et `cycstudy.js`, bougies mensuelles de data.binance.vision) : des
105 cryptos cotées en USDT sur Binance depuis 2020, 35 avaient disparu mi-2025. Des 70 restantes, 10 ont fait mieux que le
Bitcoin entre le creux de 2022 et le sommet de 2025, et 8 ont dépassé leur record de 2021. La hausse du cycle précédent ne
prédisait rien (corrélation de rang 0,04). Ce qui a compté : la taille (volume) et la tenue du prix face à l'ancien record.
Grosses et prix tenu : 8 sur 22 ont battu le Bitcoin ; petites et effondrées : 0 sur 20. Un seul cycle mesuré : une
tendance, pas une garantie.

## Données et clés

L'appli lit les données de marché publiques de Binance. L'onglet Portefeuille demande des clés API **en lecture seule** :
elles sont chiffrées sur le téléphone et ne servent qu'à des demandes de consultation fixées dans `Exchanges.java`
(soldes, positions, ordres ouverts, résultats, offres Earn). L'appli ne passe, ne modifie et n'annule aucun ordre.

## Installer

Télécharge `radar-trades.apk` depuis la dernière version : https://github.com/aminebenkhadra-dotcom/radar-trades/releases/latest

Chaque modification poussée sur `main` recompile l'APK automatiquement (onglet Actions).
