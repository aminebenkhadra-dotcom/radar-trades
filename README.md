# Radar Trades

Application Android qui scanne les contrats crypto USDT de Binance Futures, propose des setups (tendance, zone d'entrée,
stop, objectifs, taille de position), suit les trades pris et affiche le portefeuille.

## Version 42 : protection, calculs et résultats fiables

Issue des deux audits (Claude et ChatGPT) et de la note de cadrage du 23 octobre 2026. Elle corrige la protection, les calculs
et les résultats ; elle ne change pas la stratégie et ne promet aucun gain.

- **Quatre statuts.** « Prêt selon les règles » : les contrôles passent, les prix du plan sont valides sur Binance et la taille
  tient dans le profil de risque. « À surveiller » : une condition manque, ou un obstacle critique bloque (écart achat-vente
  au-delà de 0,15 %, niveau 4H ou mur du carnet avant 1R). « Refusé » : tendance ou risque en échec, écart au-delà de 0,5 %,
  plan invalide après arrondi, taille sous le minimum du contrat, plafond du compte atteint. « Données incomplètes » : contexte
  Bitcoin, carnet, bougies 15 minutes ou règles du contrat non lus ; aucun point n'est accordé à leur place. Les pourcentages
  « 95 % » et « fiabilité » ont disparu des cartes et des alertes ; le détail montre le seuil de rentabilité (1 ÷ (1 + R:R net)).
- **Taille.** Perte au stop = quantité × (distance au stop + frais d'entrée et de sortie + glissement prévu), jamais au-delà du
  budget (en % du compte ou en USDT fixes). La marge max (toutes positions), le solde disponible et la taille max du contrat
  réduisent vraiment la quantité ; le levier est abaissé quand la liquidation arriverait avant le stop (marge isolée) ; risque
  total ouvert et perte max du jour bloquent les nouvelles entrées. Rien n'est modifié en silence : le profil se confirme.
- **Prix.** Entrée au pas le plus proche, stop éloigné et objectifs rapprochés de l'entrée, quantité au pas inférieur ; ordre
  des niveaux, distance minimale et prix limites revérifiés ; R:R net recalculé sur les niveaux arrondis.
- **Protection.** Chaque position Binance montre la part couverte par ses stops (sens, côté de position, reduce-only) ; un stop
  partiel n'apparaît jamais comme une protection complète ; ordres illisibles = « protection inconnue », jamais l'ancienne lecture.
- **Résultats.** Une sortie est gagnante si elle l'est après frais et funding ; l'historique Binance est lu en entier (fenêtres
  découpées au-delà de 1 000 lignes) ; les frais en BNB sont convertis au cours du jour ; un résultat incomplet est signalé.
  Suivi sans argent : seulement les setups prêts selon les règles, version notée, prix suivis à la minute après l'entrée, sortie
  à l'ouverture en cas de gap, stop d'abord si stop et TP sont dans la même bougie.
- **Alertes.** Alerte d'entrée seulement pour « Prêt selon les règles ». La protection des positions passe d'abord, dans son
  propre canal (stop absent ou partiel, protection illisible, liquidation proche). La surveillance reprend après un redémarrage.
- **Sécurité.** Nouvelle clé de signature avec rotation (`signing/CERTIFICATS.md`) ; droits des clés API vérifiés (Binance, OKX) ;
  plus de conseil d'enlever une restriction d'adresse IP ; WebView durcie et politique de contenu stricte ; sauvegarde et
  restauration des données (jamais les clés API).
- **Tests.** `tests/run.js` avant chaque compilation, `tests/page/run.js` dans Chromium, `tests/compare.js` avant/après sur le
  code de la version 41 (`tests/README.md`).

Rejouée sur les mêmes données que la version 41 (réglage par défaut ; les règles du carnet ne se rejouent pas, faute d'historique) :

| Période | Version 41 | Version 42 |
|---|---|---|
| Octobre 2024 à octobre 2025 | 3 347 setups · 32 % · −0,08 R | 2 479 setups · 32 % · −0,08 R |
| Octobre 2025 à octobre 2026 | 2 537 setups · 36 % · +0,03 R | 1 840 setups · 36 % · +0,03 R |

La règle d'obstacle retire environ un setup sur quatre sans changer le résultat moyen (`tools/backtest/results/`). La version 42
se juge désormais en direct, dans Résultats › Suivi sans argent. Restent à faire, dans une version séparée et testée à part :
regroupement des onglets, entrées à cours limité avec échéance, sorties partielles et stops suiveurs.

- **Mes trades** lit en direct les positions ouvertes sur Binance Futures, avec leurs ordres stop et TP (y compris les ordres
  conditionnels du service « algo » de Binance), et applique les contrôles de suivi : validité, feu vert break-even, objectif,
  stop absent, stop au-delà de la liquidation, positions fermées avec leur résultat réalisé.
- **Résultats › Suivi sans argent** note chaque setup prêt selon les règles trouvé par un scan, manuel ou en arrière-plan, au
  prix du moment, puis regarde s'il touche d'abord le stop ou le TP1 (au plus 5 jours), frais et glissement compris. Le résultat
  est donné en R : on juge les signaux en direct avant d'y mettre de l'argent.
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

## Durée jusqu'au TP

La durée est le temps médian qu'ont mis les setups gagnants de la version 42 pour un TP aussi éloigné, mesuré en ATR 1H de Wilder
comme dans l'appli, sur 4 319 trades distincts des deux années : environ 11 h pour 2 à 3 ATR, 19 h pour 3 à 4, 27 h pour 4 à 5,
46 h pour 5 à 8 (`tools/backtest/ttp42.js`, `results/ttp-v42.txt` ; `timing26.js` pour la version 41). La « fiabilité » (distance au stop ÷ distance stop-TP) n'est plus
affichée depuis la version 42 : en moyenne sur environ 20 000 setups distincts elle correspondait à la part de TP atteints, mais
ce n'est pas la chance d'un setup donné.

## Potentiel pour le prochain bull run

Mesuré sur le dernier cycle (`tools/backtest/cycles.js` et `cycstudy.js`, bougies mensuelles de data.binance.vision) : des
105 cryptos cotées en USDT sur Binance depuis 2020, 35 avaient disparu mi-2025. Des 70 restantes, 10 ont fait mieux que le
Bitcoin entre le creux de 2022 et le sommet de 2025, et 8 ont dépassé leur record de 2021. La hausse du cycle précédent ne
prédisait rien (corrélation de rang 0,04). Ce qui a compté : la taille (volume) et la tenue du prix face à l'ancien record.
Grosses et prix tenu : 8 sur 22 ont battu le Bitcoin ; petites et effondrées : 0 sur 20. Un seul cycle mesuré : une
tendance, pas une garantie.

## Gestion des trades ouverts

`tools/backtest/manage.js` rejoue 20 000 setups des deux années avec plusieurs gestions : stop au break-even à +1R, +1,5R ou
+2R, moitié encaissée à +1R, stop suiveur à 2 ou 3 ATR 1H, TP à 1R ou 1,5R. Aucune ne change le résultat moyen de plus de
0,01 R. Elles changent la part de trades positifs : 34 % avec stop et TP fixes, environ 40 % avec break-even ou stop suiveur,
50 % en encaissant la moitié à +1R. L'onglet Mes trades les propose comme options, avec la taille, les frais et le funding.

## Données et clés

L'appli lit les données de marché publiques de Binance. L'onglet Portefeuille demande des clés API **en lecture seule** :
elles sont chiffrées sur le téléphone et ne servent qu'à des demandes de consultation fixées dans `Exchanges.java`
(soldes, positions, ordres ouverts, résultats, offres Earn). L'appli ne passe, ne modifie et n'annule aucun ordre.

## Installer

Télécharge `radar-trades.apk` depuis la dernière version : https://github.com/aminebenkhadra-dotcom/radar-trades/releases/latest

Chaque modification poussée sur `main` lance les tests puis recompile et signe l'APK (onglet Actions). Chaque release joint
`signature.txt` (certificats et lineage) et `tests.txt`.

## Version Chrome (ordinateur)

`extension/` et `tools/build-extension.js` : la même page en extension Chrome (fichier `radar-trades-chrome.zip` joint à chaque
release). Scanner, setups, analyse, heatmaps, tendance, cycle et alertes tant que l'onglet est ouvert. Pas de clé API ni de
portefeuille : ils restent dans l'appli Android. Installation : décompresser, `chrome://extensions`, « Mode développeur »,
« Charger l'extension non empaquetée », choisir le dossier `RadarTrades-Chrome`.
