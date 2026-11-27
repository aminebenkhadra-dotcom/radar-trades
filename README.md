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

## Potentiel au-delà du TP (Mes trades)

Étiquette « Potentiel · TP ↑ prix » sur un trade actif quand le prix a fait les trois quarts du chemin vers l'objectif, que les
tendances 4H et 1J vont dans le sens du trade et que l'élan n'est ni essoufflé ni excessif (`tpUp` dans le moteur) ; pas
d'étiquette si le conseil est « Sortir ». Mesuré sur deux ans (`tpup.yml`, `tools/backtest/tpup42.js`, `results/tpup-v42.json`,
880 signaux sur 4 357 trades) : objectif relevé atteint 59 fois sur 100, retour au stop 35 fois sur 100 si le stop reste en
place, résultat moyen égal à celui du TP d'origine (+1,59 R). Le texte le dit et conseille de monter le stop au break-even ou
de garder la moitié au TP actuel. Une notification à l'apparition du signal.

## Mise à jour du 17/11/2026

- **Scanner par Levels** de capitalisation (CoinGecko, classement gardé 6 h) : Level 1 (1er au 30e), 2 (31e-60e), 3 (61e-200e),
  4 (201e-400e), 5 (401e-1000e), à la place de Tous / Top 10 / Top 50. Levels 1 et 2 : toutes les cryptos cotées sur Binance
  Futures (contrat USDT perpétuel) sont analysées ; Levels 3 à 5 : celles qui ont une tendance 1 jour. Alertes « prêt à saisir »
  par Level (réglages ; Top 50 → Levels 1 et 2 à la mise à jour, drapeau `nt45`).
- **Heure de la reco** : première apparition d'un setup (même crypto, même sens, retrouvé à moins de 2 h d'écart) et passage à
  « Prêt » (`radar-seen`) ; affichée sur la carte, dans le détail (avec l'âge du scan) et dans la notification.
- **Tendance** : jour, semaine, mois, 90 jours et année dans un même tableau ; largeur du marché sur 90 jours.
- **Cycle** : dates projetées de chaque phase depuis le halving d'avril 2024 (calendrier des cycles 2016 et 2020).
- **Temporalité** : une décision en tête (feu vert, prudence jour faible, marché calme, ou pas de trade si le réglage écarte
  lundi et mardi), le détail des mesures replié.
- **Mes trades** : exposition totale (perte si tous les stops sont touchés, gain si tous les TP sont atteints, frais compris,
  stops et TP réels pour Binance) ; « Au stop » et « Au TP » sur chaque trade.
- **Après sortie** : classement TP touché / SL touché / en cours d'après le stop et l'objectif du trade fermé (`afterClass`),
  sorties par le stop comprises (reclassées TP si l'objectif est atteint ensuite).
- **Actus** : seulement macro, régulation, sécurité, stress de marché, gros flux, plateformes en difficulté ; un titre par
  histoire ; sans résumé.
- **Stop exposé = Refusé** (plus « À surveiller »). Cas du short XMR du 16/11 : l'appli plaçait le stop à 516,60, le sommet 1H de
  10 h était à 518,29 ; le setup était retenu à chaque scan pour « Stop exposé ». Pris quand même, il a été stoppé par un retour au-dessus
  du sommet (521,99), puis le prix est revenu sous l'entrée (`tools/backtest/case.js`, workflow `case.yml`). Ces setups ne sont plus
  proposés du tout : mêmes trades écartés que la variante f24 de `stop42.js` (−0,064 R et +0,062 R par trade, contre −0,081 et +0,017).
- **Notification « stop exposé »** sur un trade ouvert (Binance ou suivi) dont le stop est juste derrière le dernier sommet ou creux
  1H des 24 h avant l'entrée : stop plus sûr, réduction de taille pour garder le même risque, ou sortie. Une fois par niveau de stop.
- **Correctif du 18/11 : le contrôle « stop exposé » ne marchait pas dans l'appli.** Le plan était arrondi au pas de prix du
  contrat avant le contrôle, et le contrôle comparait le stop arrondi au stop d'origine : ils ne correspondaient jamais, donc aucun
  setup n'était retenu en scan réel (cas BTW short « Prêt » du 18/11, plus haut 24 h à 0,5367 au-dessus du stop à 0,5144). Les tests
  de rejeu, eux, n'arrondissent pas : leurs résultats restent valables. Le contrôle s'appuie maintenant sur « stop non déplacé ».
- **Capital** : toutes les lignes, sans regroupement « Autres ».

## Stop exposé (scanner et Mes trades)

Le stop d'un setup se place à 0,5 ATR 4H derrière la zone. Quand le dernier sommet (short) ou creux (long) des bougies 1H des
24 dernières heures est au-delà de ce stop, ou moins de 0,15 ATR devant, un retour sur ce niveau déclenche le stop. Cinq
variantes rejouées sur deux ans (`stop.yml`, `tools/backtest/stop42.js`, `results/stop-v42.json`) : déplacer le stop derrière
le sommet (12, 24 ou 48 h) n'améliore pas les deux années ; retenir le setup (« À surveiller », blocage `stopx`) améliore le
résultat moyen les deux années (−0,081 → −0,064 R, +0,017 → +0,062 R), le total aussi, avec 40 % de setups prêts en moins.
Retenu dans Radar Trades (`opts()` : `slsw:24, slmode:"flag"`) ; le moteur garde `slsw:0` par défaut, donc Radar BTC·ETH et
Radar Top 50 ne changent pas. Sur un trade actif, la vérification affiche « Stop exposé » en premier, avec un stop plus sûr
et la taille qui garde le même risque (sans effet sur le score).

## Conseil de sortie plus réactif (Mes trades)

Le conseil « Sortir » d'un trade actif dépend d'un niveau réglable (Profil → « Conseil de sortie des trades actifs ») : score
de l'état du trade à 2 ou moins (réactif, par défaut), 1 ou moins (équilibré), 0 ou moins (tardif, l'ancien réglage). Chaque
niveau a été rejoué sur deux ans comme une règle, l'état lu toutes les heures (`exit.yml`, `tools/backtest/exit42.js`,
`results/exit-v42.json`, 4 363 trades) : le conseil arrive avant le stop pour 48 / 27 / 18 trades perdants sur 100, avec une
sortie vers −0,5 R au lieu de −1 R, et coupe 22 / 9 / 7 trades gagnants sur 100. Résultat moyen par trade inchangé
(+0,01 R au mieux) : aucune règle de sortie testée, parmi 17, n'améliore nettement la moyenne. L'encadré de vérification
affiche « Sortie conseillée » quand l'étiquette dit « Sortir », et la notification de sortie suit le même niveau.

## Pourquoi peu de trades « prêts » : mesure et outils de contrôle

Rejeu de deux ans sans prendre de trade, l'étape de chaque marché notée toutes les 15 minutes (`funnel.yml`,
`tools/backtest/funnel42.js`, 60 marchés les plus échangés, contrôles sur bougies seulement). À un instant donné, sur 60 :
9 sans tendance 1J, 18 sans tendance 4H ou 4H contre 1J, 10 avec une zone encore loin, 6 en approche, 17 à la zone sans
valider les contrôles, 0,4 retenus par l'obstacle 4H avant 1R, 0,5 prêt. Au moins un « prêt » 27 % du temps. Un état
« prêt » dure 15 minutes dans plus de la moitié des cas (33 minutes en moyenne). Alertes attendues avec un contrôle toutes
les 15 / 30 / 60 minutes : 12 / 10 / 7 par jour ; sans le blocage « obstacle avant 1R » : 21 / 17 / 13.

Dans l'appli : sous les compteurs du scanner, « Détail du scan : où s'arrêtent les marchés » (chaque étape et son nombre,
puis les raisons pour lesquelles les setups affichés ne sont pas prêts) ; dans les réglages d'alertes, « Derniers contrôles
en arrière-plan » (30 derniers passages : heure, résultat, nombre de setups à la zone et raisons principales).
L'onglet « Tous » analyse en détail les 60 marchés en tendance les plus échangés et affiche 15 setups au plus.

## Alerte « trade prêt à saisir »

Notification quand un setup du Top 50 (ou du Top 10) passe à « Prêt selon les règles » : toutes les règles au vert, prix dans
la zone d'entrée, limites du compte respectées. Titre « SOL · Long prêt à saisir · 6/6 contrôles » ; texte : taux de réussite
passé de ce type de setup, entrée, stop, TP1 et taille. Une fois par setup et par sens toutes les 4 heures. Activée d'office
pour le Top 50 à la mise à jour (drapeau `nt44`, enregistré dans les réglages) ; les deux cases restent modifiables.

## Stop à déplacer après le break-even (Mes trades)

Une fois le stop au break-even ou mieux, étiquette verte « Sécuriser · SL ↑ prix » (↓ pour un short) et encadré « Sécuriser
plus » : stop proposé à une unité de risque derrière le meilleur prix atteint depuis l'entrée (`trailStop`, règle `r1`), dès
qu'il verrouille au moins 0,1 R de plus que le stop actuel ; jamais sous le break-even, jamais sur un trade « Sortir ».
Six règles comparées sur deux ans (`trail.yml`, `tools/backtest/trail42.js`, `results/trail-v42.json`, 2 223 trades passés
par +1 R) : aucune ne bat nettement le TP fixe en moyenne (+0,92 R) ; `r1` est la plus régulière (+0,89 et +0,92 R), avec
8 trades sur 100 au-delà de 2,5 R. Bouton « J'ai déplacé mon stop » pour les trades suivis à la main ; pour Binance, l'appli
lit le nouveau stop. Une notification à chaque demi-unité de risque verrouillée en plus.

## TP à réduire (Mes trades)

Étiquette orange « Prudence · TP ↓ prix » quand un niveau 4H se trouve avant l'objectif et que la tendance n'est plus franche
(4H ou 1J plus dans le sens du trade, ou élan qui s'essouffle), ou que deux niveaux barrent la route (`tpDown`, type « lvl ») ;
jamais quand le conseil est « Sortir ». Mesuré sur deux ans (`tpdn.yml`, `tools/backtest/tpdn42.js`, `results/tpdn-v42.json`,
635 signaux) : objectif d'origine atteint 21 fois sur 100, objectif réduit 50 fois sur 100, gain moyen +0,05 R par trade
(+0,06 et +0,04 selon l'année). Le cas « tendance retournée sans niveau » (type « exh ») n'a pas d'étiquette : dans le test il
tombait toujours dans un état « Sortir », et réduire l'objectif n'y apportait rien. Une notification à l'apparition du signal.

Après sortie : le verdict reste celui du stop et de l'objectif du trade fermé (premier touché), et le prix continue d'être
suivi après, jusqu'à la suppression.

## Synchronisation téléphone et Chrome

Réglages → « Synchronisation téléphone et Chrome » : un dépôt GitHub privé de l'utilisateur (compte/nom) et un code d'accès
GitHub limité à ce dépôt (fine-grained token, droit « Contents : read and write »). À activer une fois sur chaque appareil.
Un seul fichier, `radar-trades.json` : réglages (sans les interrupteurs d'alerte, propres à chaque appareil), trades suivis à
la main, Après sortie, saisies du portefeuille, suivi sans argent, et une copie des positions Binance telles que le téléphone
les a lues (`radar-live-view`). Jamais les clés API ni le code d'accès. Chaque synchro est une fusion à trois (`syncMerge` :
cet appareil, le fichier, l'état de la dernière synchro) : listes fusionnées élément par élément, réglages champ par champ.
Envoi 5 secondes après un changement, lecture toutes les 90 secondes quand l'appli est ouverte, et à chaque contrôle en
arrière-plan sur le téléphone. Dans Chrome, sans clés, Mes trades affiche la copie des positions avec son heure.

## Fiabilité d'un trade actif (Mes trades)

Chaque trade actif porte une étiquette « Fiabilité x % · Attendre / Sortir ». Le moteur lit l'état du trade (`tradeState` :
tendances 4H et 1J, volume et flux, setup inverse, avancement, distance au stop, âge, élan), le même état a été relevé toutes
les 4 heures sur chaque trade du test de deux ans (26 745 relevés, `state.yml`, `tools/backtest/state42.js`,
`results/state-v42.json`). Le % est la part des trades dans le même état qui ont ensuite atteint le TP1. « Sortir » quand le
score est à 0 ou moins, ou que la vérification du trade dit « sortie à envisager » : dans ces états, rester a coûté 0,07 à
0,10 R en moyenne par rapport à une sortie immédiate, les deux années. Sans stop, pas de fiabilité.

## Après sortie

Un trade clôturé dans Mes trades, ou une position Binance qui se ferme, arrive dans l'onglet « Après sortie » : l'appli continue
de le simuler avec son stop et son objectif (bougies Binance depuis la sortie, stop avant objectif dans une même bougie) jusqu'à
ce que l'utilisateur le supprime. Verdict : bonne décision, sortie trop tôt ou égalité. Liste à part (`radar-after`) : rien n'est
lu par Mes trades, Résultats ou l'export Excel. Pour Binance, le prix de sortie exact vient des exécutions (`userTrades`).

## Configuration du moment (onglet Analyser)

Pour chaque crypto analysée : le type de setup (sens, et zone : order block + niveau 4H, order block seul, ancien niveau
qui a changé de côté, niveau 4H seul), le nombre de repères sur la zone, le potentiel jusqu'au TP1 et jusqu'au stop, et le
taux de setups de ce type qui ont atteint le TP1 avant le stop. Taux mesuré en rejouant la version 42 sur deux ans
(4 338 setups « Prêt », `config.yml`, `tools/backtest/config42.js`, `results/config-v42.json`), année par année ;
signalé comme indicatif quand il y a moins de 150 setups ou plus de 10 points d'écart entre les deux années.

## Export Excel de l'historique

Onglet Résultats (source Binance Futures) : « Exporter en Excel » sur 7, 30 ou 90 jours ; aussi dans Mes trades, sous l'historique Binance (90 jours).
Le fichier .xlsx a quatre onglets : Résumé (taux de réussite, net, frais, funding, par contrat, par jour d'ouverture, en formules),
Trades (une ligne par position, de l'ouverture jusqu'au retour à zéro), Exécutions (chaque fill Binance) et Revenus Binance
(gains, frais et funding tels que Binance les enregistre). Lecture seule : `/fapi/v1/userTrades`, par fenêtres de 7 jours, seulement
là où Binance a enregistré des frais. Fichier construit dans le téléphone, enregistré où tu le choisis.

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

## Correctif du 19/11/2026 : plus aucun trade proposé

- Rejeu de la version 42 sur les 18 premiers jours de novembre (workflow `live.yml`, branche `live-check`). Le moteur voit des
  setups prêts chaque jour : le 18/11, 18 épisodes « prêt » sur les Levels 1–2 (10 alertes avec un contrôle toutes les 30 min),
  19 sur le Level 3, 14 sur l'ancien Top 50 en volume. Le refus du « stop exposé » enlève environ un tiers de ces setups.
- Ce qui peut encore tout bloquer, c'est le compte : risque total au plafond, position sans stop complet (Mes trades ou Binance),
  perte du jour atteinte. Un setup prêt côté marché passait alors en « Refusé », sans rien qui le signale en haut du scan.
- Ajouté : un bandeau rouge « Ton compte bloque les nouveaux trades » avec la raison, et en tâche de fond une notification
  « Trade prêt mais bloqué par ton compte », au plus une toutes les 6 heures. Test de page P18.

## Correctif du 19/11/2026 (2) : trade « Prêt » vu au scan, jamais notifié

Causes trouvées :
- Le contrôle de fond tournait toutes les 30 minutes avec une alarme approximative : Android peut la retarder de 75 % du délai,
  soit un contrôle toutes les 30 à 52 minutes. Un état « prêt » dure 15 minutes dans plus de la moitié des cas : il passait entre deux contrôles.
- Les puces Longs / Shorts de la liste servaient aussi de filtre aux alertes : laissées sur « Shorts », aucun long n'était notifié.
- Seuls les Levels cochés dans les alertes (1 et 2 par défaut) sont contrôlés en fond : un « Prêt » du Level 3 n'est jamais notifié.
- Décocher tous les Levels ne coupait pas les alertes de trades prêts (valeur vide remplacée par « 12 »).

Corrigé :
- Contrôle calé 75 secondes après la clôture de chaque bougie de 15 minutes, avec une alarme exacte (USE_EXACT_ALARM ;
  SCHEDULE_EXACT_ALARM jusqu'à Android 12L). 15 minutes par défaut ; un réglage resté à 30 par défaut passe à 15 (nt46).
- Alertes sur les deux sens, quel que soit le filtre de la liste.
- Une alerte par setup (heure de repérage du setup), 4 heures au plus : un setup disparu plus de 2 heures puis revenu est notifié.
- Sur chaque carte « Prêt » : « Notification envoyée à HH:MM », ou la raison (Level non surveillé, avec un bouton pour le surveiller ;
  notifications bloquées ; pas encore vu, prochain contrôle à HH:MM). Test de page P19.

## Correctif du 21/11/2026 : « jamais de trade des Levels 1 et 2 »

- Chaque notification de trade prêt donne le Level et le rang par capitalisation (« SUI · Long prêt à saisir · Level 1 »,
  puis « Level 1, n°11 par capitalisation · … »). Chaque carte de setup a la même étiquette (« Level 1 · n°11 »).
- Étape 3 du scan (déclencheur 15 min, carnet, squeeze) : les setups proches de leur zone d'abord, les plus grosses capitalisations
  d'abord parmi eux. Avant, les 20 places allaient aux meilleurs scores : avec les Levels 3 à 5 cochés, un setup du Level 1 ou 2
  près de sa zone pouvait ne jamais être lu, donc jamais « Prêt » ni notifié. Un scan de plusieurs Levels en lit 30.
- Verrou de réveil du contrôle de fond porté à 8 minutes (relâché à la fin du contrôle) : un contrôle de plusieurs Levels peut dépasser 4 minutes.
- Tests de page : l'horloge est fixée au jeudi 19/11/2026 16:50 UTC (`TEST_NOW` pour une autre heure). Le marché simulé dépendait de
  l'heure du lancement et P19 échouait le matin.

## Vérification du 22/11/2026 : « que des shorts »

Rejeu des règles de l'appli du 8 au 21/11 sur les 430 contrats des Levels 1 à 5 (workflow `side.yml`, branche `side-check`,
script `tools/backtest/side42.js`, option d'étude `funnelWhy` du moteur) :
- Aucun long prêt en 14 jours, sur tous les Levels. Shorts prêts : 403 épisodes sur les Levels 1-2, 617 sur le Level 3, 2 684 sur les Levels 4-5.
- À un instant donné, sur les 35 contrats des Levels 1-2 : 0 à 2 avec un setup long, 27 à 32 avec un setup short.
- Longs arrivés à leur zone : retenus d'abord par le contrôle « Marché » (Bitcoin en baisse sur 4H), 28 à 36 % des cas.
- Bitcoin : 86 483 le 4/10, 55 127 au plus bas le 21/11 (−36 %). Les longs vus par Amine sont des rebonds contre la tendance
  (21-22/11 : 55 127 → 61 648, +12 %), que les règles ne prennent pas.

Ajouté : sur la ligne du marché, « Longs en pause : Bitcoin baisse sur 4H » (ou « Shorts en pause », ou les deux) quand le contrôle
« Marché » bloque tout un côté. Test de page P20 (marché simulé avec un Bitcoin en baisse). Carte de setup : le rang n'apparaît
plus deux fois (« Level 1 · n°11 » remplace « Cap. n°11 »).

## Mise à jour du 22/11/2026 : page d'accueil et vue simple

- L'appli s'ouvre sur une page d'accueil : les 5 Levels (avec, pour chacun, le nombre de cryptos prêtes, en cours et sans trade
  au dernier scan), un champ « Analyser une crypto », puis des tuiles pour Mes trades, Après sortie, Résultats, Tendance, Cycle,
  Temporalité, Actus, Heatmaps, Analyser, Fondamental, Simulateur, Portefeuille, Capital, Earn et Réglages. La barre d'onglets
  n'est plus affichée. Chaque page a un bouton retour ; la touche retour d'Android revient à l'accueil (historique du navigateur).
- Réglages (alertes, précision, profil de risque, sauvegarde) : une page à part. « Vérifier » du bandeau de profil y mène.
- Vue simple d'un Level : la grille des cryptos, verte si prête, orange si en cours (setup en formation ou données pas toutes
  lues), rouge sinon (pas de setup, ou setup refusé). Un appui : un résumé (sens, raison en une ligne, entrée, stop, TP1) ;
  « Voir le détail » : la carte complète. « Vue détaillée » rend les anciennes listes (`radar-vue` dans le stockage local).
- Analyser : le même résumé d'abord, l'analyse complète derrière « Voir le détail ».
- Une notification ouvre toujours son trade (résumé sous la grille), avec l'accueil un pas en arrière.
- Tests : `open()` arrive sur le Level 1 en vue détaillée sauf `home` / `simple` ; navigation par `nav()` via l'accueil ; P21.

## Mise à jour du 23/11/2026 : pause pendant les rebonds de Bitcoin, alerte de mouvement brutal

Constat (rejeu des règles de l'appli, novembre 2026, Levels 1 à 3, frais compris) : 203 trades, dont 202 shorts, 62,6 % gagnants,
+169,3 R. Mais les 8 shorts du 20/11 08:00 au 22/11 ont tous perdu (BTW, ZAMA, ETHFI, ETC, SUI, WLD, ENS, STX) : Bitcoin
rebondissait de 55 127 (plus bas du 21/11) vers 61 648.

Ajouté, contrôle « Marché » : pas de short tant que Bitcoin est 7 % ou plus au-dessus de son plus bas des 72 dernières heures,
pas de long tant qu'il est 7 % ou plus sous son plus haut des 72 heures (`REB=7` dans la page, option `reb` du moteur, 0 par défaut :
Radar Top 50 et Radar BTC·ETH gardent leurs règles). La carte le dit (« Bitcoin a rebondi de 9,8 % depuis son plus bas de 72 h :
pas de short pendant un rebond »), la ligne du marché aussi (« Shorts en pause : … »). `market()` donne `up3` / `dn3`.

Mesure (workflow `reb.yml`, branches `reb-v42-A` à `D`, 60 marchés les plus échangés sauf la dernière ligne) :

| Période | Règles d'avant | Avec la pause à 7 % |
|---|---|---|
| sept. 2024 → oct. 2025 | −96 R (1 494 trades) | −49 R (1 381) |
| oct. 2025 → oct. 2026 | +71,4 R (1 154) | +53,4 R (1 113) |
| oct. → nov. 2026 | +80,9 R (102) | +84,0 R (99) |
| novembre 2026, Levels 1 à 3 | +169,3 R (203), pire série 8 pertes | +175,5 R (197), pire série 5 |

La pause coûte 18 R en 2025-26 : les shorts écartés y gagnaient (48,5 %). Seuils testés : 5, 7, 9 et 12 %. 5 et 7 % font à peu
près pareil, 9 et 12 % n'aident pas. Gain modeste, pas garanti : retenu parce qu'il coupe les séries de pertes pendant les rebonds.

Ajouté : alerte « mouvement brutal » (Réglages, cochée par défaut). À chaque contrôle de fond, la dernière bougie 15 min close de
Bitcoin : notification si elle fait ±2,5 % avec un volume d'au moins 6 fois la moyenne des 20 précédentes, ou si Bitcoin a fait ±4 %
en une heure. Une seule par sens toutes les 3 heures. Ce n'est pas un trade proposé. Rejouée sur Bitcoin du 8 au 23/11 : 4 alertes
(15/11 02:45, 21/11 03:45 et 07:00, 23/11 14:00, la hausse de +4,2 % en 15 min sur un volume ×25).

Étudié, pas retenu (workflow `rev.yml`, branches `rev-v42-A` à `C`, script `tools/backtest/rev42.js`) :
- Trades de rebond (long après une chute de 3 ATR journaliers et un RSI 4H sous 25, déclencheur 1H ; short à l'inverse).
  Longs : +0,18 à +0,27 R par trade en 2024-25, −0,06 à +0,01 en 2025-26, −0,42 à −0,66 en octobre-novembre 2026 (variante à
  objectif EMA20 4H : −0,14, +0,01, +0,04). Shorts : −0,19 à −0,26 R en 2024-25, −0,13 à +0,01 en 2025-26, 1 à 4 trades ensuite.
- Trade « trop tard » : le filtre sur le RSI 4H n'écarte aucun trade ; celui sur le RSI journalier donne +49 R en 2024-25, +10 R
  en 2025-26, −24 R en octobre-novembre 2026.
- Les longs de tendance perdent sur deux ans (−0,12 R par trade en 2024-25, −0,07 en 2025-26) : à traiter à part.

`nov.yml` (branche `nov-check`) liste aussi, trade par trade, ce qu'auraient donné les rebonds en novembre (`nov-revM.json`,
`nov-revRB.json`). Tests de page : P20 (rebond simulé, aucun short prêt), P22 (bougie de +4,2 % sur un volume ×28 : une
notification, une seule, et le réglage la coupe).

## Mise à jour du 23/11/2026 (2) : shorts seulement

Demande d'Amine : peu importe le sens et les règles, des trades qui marchent. Rejeu sur 60 marchés, frais compris (workflow
`short.yml`, branches `short-v42-A` à `D`, option `side` du moteur, script `tools/backtest/rev42.js` avec le détail par configuration) :

| Période | Règles d'origine | Build 81 (deux sens, pause) | Shorts seulement, pause |
|---|---|---|---|
| sept. 2024 → oct. 2025 | −96 R | −49 R | +26,3 R (725 trades, 36,6 % gagnants) |
| oct. 2025 → oct. 2026 | +71,4 R | +53,4 R | +78,1 R (760 trades, 38,4 %) |
| oct. → nov. 2026 | +80,9 R | +84,0 R | +86,1 R (97 trades, 64,9 %) |

- Les longs de tendance ont perdu les deux années : −75,3 R (656 trades) en 2024-25, année de hausse, et −24,7 R (353) en 2025-26.
- Shorts seulement sans la pause : −20,7 R, +97,2 R, +83,0 R. La pause rapporte 47 R en 2024-25 et en coûte 19 en 2025-26 : gardée.
- Novembre 2026, Levels 1 à 3 : 196 trades et +173,5 R avec le build 81, 195 et +174,6 R en shorts seulement.
- Ce que ça donne en temps normal : 37 % de trades gagnants, +0,04 à +0,10 R par trade, un mois sur deux négatif, jusqu'à 30 pertes
  d'affilée dans le rejeu. Novembre 2026 (64 % de gagnants, +0,9 R par trade) est exceptionnel.
- Par configuration (shorts, pause) : sous résistance 4H, positif sur les quatre périodes (+0,12, +0,13, +0,96, +0,94 R par trade) ;
  sous order block seul, négatif sur les deux années (−0,38 et −0,14) mais positif en octobre-novembre 2026 : gardé.

Réglages › Précision des setups › « Trades proposés » : « Shorts seulement (conseillé) » par défaut, « Longs et shorts » pour
revenir aux deux sens (`S.longs`, `SIDE()` dans la page, `side: -1` passé au moteur ; 0 par défaut dans le moteur, les apps sœurs
gardent leurs règles). Un long reste visible, refusé au contrôle « Tendance » avec la raison ; il n'est jamais « Prêt » ni notifié.
La ligne du marché ne parle plus de longs en pause et dit « longs non proposés » quand le fond est haussier. Test de page P23.

## Mise à jour du 23/11/2026 (3) : les deux sens, « Prêt » pour les profils gagnants

Amine : « ne bloque rien du tout, analyse les deux et donne-moi les trades gagnants ». Les longs reviennent (fin du « shorts seulement »
du build 82) et la pause rebond du build 81 est coupée (`REB=0`).

Étude : chaque trade rejoué avec son profil (option `feat` du moteur, `feat.yml` et `feat0.yml`, scripts `tools/backtest/feat42.js` et
`tools/backtest/prof42.js`), 30 critères découpés en quelques classes, longs et shorts à part. Deux profils sont restés gagnants les deux
années, aussi sur la base la plus large (tous les setups à leur zone, niveau de précision 0) :
- long dans un marché agité (amplitude 24 h au-dessus de 130 % de la normale) : +0,14 et +0,12 R par trade, contre −0,11 et −0,07 pour
  tous les longs ; en marché calme, −0,29 et −0,30 ;
- short quand Bitcoin a baissé de 0 à 1 % sur 4 h : +0,16 et +0,27 R par trade, contre −0,02 et +0,12 pour tous les shorts.

Règle (option `prof` du moteur, `S.prof`, cochée par défaut dans Réglages › Précision) : « Prêt » et alertes seulement pour ces deux
profils ; les autres setups restent « À surveiller » avec la raison ; chaque profil gagnant le dit sur sa carte (contrôle « Marché »).
Rejeu de contrôle (`profv.yml`, branches `profv-v42-A` à `D`) :

| Période | Règles d'origine | Profils gagnants |
|---|---|---|
| sept. 2024 → oct. 2025 | −96 R (1 494 trades, 33 % gagnants) | +27,7 R (711 trades, 37 %) |
| oct. 2025 → oct. 2026 | +71,4 R (1 154 trades, 37 %) | +132,6 R (634 trades, 42 %) |
| oct. → nov. 2026 | +80,9 R (102 trades, 62 %) | +53,7 R (70 trades, 60 %) |
| novembre 2026, Levels 1 à 3 | +167,3 R (202 trades, 62 %) | +120,6 R (141 trades, 63 %), pire série 4 au lieu de 8 |

- Longs : −75,3 → +26,6 R et −25,8 → +15,0 R. Shorts : −20,7 → +1,0 R et +97,2 → +117,6 R.
- Baisse maximale 56 R au lieu de 147 en 2024-25, 44 au lieu de 72 en 2025-26 ; 11 mois négatifs sur 25 ; pire série 31 pertes (2024-25).
- Limite : les profils ont été choisis sur ces deux années ; leur régularité, la base large et les semaines récentes les soutiennent.
  La condition des shorts suit Bitcoin sur 4 h : elle change d'un quart d'heure à l'autre, le rejeu la mesure telle quelle.
- Derniers shorts d'Amine (export du 23/11) : la règle aurait proposé STABLE (20/11, gagnant) et BCH (23/11, perdant), pas BTW, ALCH,
  JELLYJELLY ni XMR (Bitcoin en hausse, ou déjà en baisse de plus de 1 % sur 4 h).

Tests de page : P23 (profils gagnants), P20 sans pause rebond.

## Mise à jour du 24/11/2026 : les 8 points du mémo, testés sur deux ans

Mémo d'Amine (vidéo d'un trader, projet « Application Crypo ») : 8 améliorations. Demande : toutes, mais seulement ce qui rapporte.
Chaque point rejoué sur les 60 marchés les plus échangés (2024-25, 2025-26, octobre-novembre 2026) et sur les Levels 1 à 3 en novembre,
frais compris, avec les règles de l'appli (profils gagnants). Workflows `memo.yml` (mesures de chaque trade, sorties, mode range),
`memov.yml` (contrôle), `supply.yml` (offre en circulation) ; scripts `tools/backtest/memo42.js` et `feat42.js`.

| Point | Résultat | Dans l'appli |
|---|---|---|
| 1. Sortir à la cassure du dernier sommet / creux | 1H : −52 R en 2024-25, −91 R en 2025-26 ; 4H : −25 R et 0 R. Les trades coupés finissaient mieux que la sortie | Non, le stop reste |
| 2. Pivots hebdomadaires | Shorts sur un pivot meilleurs en 2024-25 et 2025-26, moins bons en octobre-novembre 2026 ; longs dans l'autre sens | Non |
| 3. Gros niveau à moins de 3 % | Longs : −0,05 et −0,03 R par trade contre +0,20 et +0,21 ; shorts : écartés encore gagnants | Longs seulement : orange |
| 4. Zone morte entre les moyennes | Longs en zone morte meilleurs ; shorts partagés | Non |
| 5. Force face à Bitcoin (24 h, 7 j) | Sens qui change d'une période à l'autre | Non |
| 6. Mode range (zone de valeur, ADX bas) | −0,11, −0,18, −0,09 et −0,50 R par trade | Non |
| 7. Annonce forte dans les 24 h (FOMC, CPI) | Moitié de taille : +11,5 R en 2024-25, −1,0 R en 2025-26, −6 R en novembre 2026 | Bandeau et conseil, rien d'écarté |
| 8. Moins de 60 % de l'offre en circulation | Longs partagés ; shorts un peu moins bons mais gagnants | Non |

Contrôle du point 3 (`memov.yml`) : 2024-25 +27,7 → +27,8 R (longs +0,13 → +0,17 R par trade, baisse maximale 56 → 51 R),
2025-26 +132,6 → +137,3 R (longs +0,13 → +0,24 R par trade). Option `big` du moteur (`r.wk` : pivots et extrêmes hebdomadaires de chaque
setup), liée à la case « profils gagnants » de Réglages › Précision.

Point 7 : `ANN` dans la page, dates officielles (Fed, BLS, BEA) de novembre 2026 à décembre 2027, CPI, PCE et Fed ; bandeau en haut du
scan et mention dans la notification d'un trade prêt quand une annonce tombe dans les 24 h (« moitié de taille conseillée »). À
prolonger fin 2027. Tests de page : P24 (annonce), P16 et P23 mis à jour.

## Mise à jour du 24/11/2026 (2) : page « Global » et choix de la vue en haut

- « Global » : Levels 1 à 5 dans un seul scan (`GLOBAL="l12345"`), premier bouton de la barre des Levels et première tuile de l'accueil.
  Comme pour plusieurs Levels cochés, le détail est lu sur les cryptos les plus proches de leur zone, les plus grosses capitalisations
  d'abord.
- « Vue simple · Vue détaillée » : un sélecteur juste sous les Levels (`#vseg`). L'ancien bouton était sous toute la liste détaillée :
  une fois passé en vue détaillée, Amine ne retrouvait plus la vue simple.
- Tests de page : P21 (sélecteur en haut, page Global), P17 et P10 mis à jour.

## Mise à jour du 24/11/2026 (3) : page « Suivi »

Chaque trade que l'appli met « Prêt » (scan à l'écran ou contrôle en arrière-plan) est enregistré une fois par épisode (crypto, sens,
moment où il passe prêt) dans `radar-track`, puis joué sur les bougies 15 min qui suivent : entrée au prix du marché à ce moment,
stop et TP1 du plan, frais et glissement compris ; une bougie qui touche le stop et le TP compte comme stop. La page « Suivi »
(tuile de l'accueil) donne les trades terminés, les gagnants, le total et la moyenne en R, et chaque ligne. Elle se relit à chaque
ouverture. Seuls les Levels scannés sont suivis (en arrière-plan : les Levels surveillés). Test de page P25.
`pool()` accepte maintenant d'être appelé sans suivi de progression.

## Mise à jour du 25/11/2026 : mémo 2 et montants en USDT dans le Suivi

Mémo 2 d'Amine (projet, revu) : rejoué sur deux ans et novembre, règles de l'appli, frais compris (workflow `memo2.yml`, open interest
et funding de data.binance.vision passés au rejeu par `ref.js`, option `feat2` du moteur).

| Point du mémo | Rejeu | Dans l'appli |
|---|---|---|
| 1. Prix contre open interest sur 24 h (top 30) | Cas rares ; « vendeurs qui ajoutent » : shorts −0,18 et −0,10 R par trade ; « hausse sans acheteurs » : +0,12 puis −0,03 | Étiquette neutre (contrôle « Marché »), funding extrême ajouté au texte |
| 2. Moitié de taille hors top 20 | 85 à 90 % des trades sont hors top 20 : gains −33 à −45 %, baisse maximale divisée par deux | Non appliqué |
| 3. Retest d'un V (0,618–0,786) | Shorts −0,33 puis +0,70 R par trade, longs +0,36 puis +0,08 : pas régulier | Non |
| 4. Volatilité compressée (10e centile de l'année) | Trades meilleurs les deux années, des deux côtés (shorts +0,37 et +0,34 R, longs +0,27 et +0,68) | Avertissement « garde le stop prévu » (contrôle « Risque ») |
| 5. Pivot du jour | Écarté par le mémo | Non |

Suivi : chaque ligne donne la taille de la position et le risque en USDT (budget de risque du trade au moment où il passe prêt, ou
celui de Réglages), et le résultat en USDT ; le total est en USDT, avec les R à côté.

## Mise à jour du 26/11/2026 : quatre réglages au choix, comparés dans le Suivi

Sélecteur « Réglage » sur l'accueil et au-dessus des Levels. Le réglage choisi fait les listes, les « Prêt » et les notifications ; le Suivi
joue les quatre en même temps à chaque scan (un onglet par réglage, bilan côte à côte).

| Réglage | Règles | Rejeu 2024-25 | Rejeu 2025-26 | Oct.-nov. 2026, Levels 1-3 |
|---|---|---|---|---|
| Radar (défaut) | règles actuelles : profils gagnants, grosse résistance sur les longs, étiquettes | +27,8 R | +137,3 R | +94,5 R |
| Avant les mémos | profils gagnants seuls (règles du 23/11) | +27,7 R | +132,6 R | +94,5 R |
| Nico | gros niveau à moins de 3 % des deux côtés et zone morte en « À surveiller », pivots et force face à BTC au score, mode range, sortie à l'inversion 1H, demi-taille avant annonce ou hors top 20 | −162,6 R | −166,2 R | −51,3 R |
| RSI · Volume | rebond sur support / rejet sous résistance 4H, RSI 1H ≤ 30 / ≥ 70 sur 3 h, volume 1,5 fois la normale, TP au niveau suivant (1,5 à 3 R) | −327,1 R | −63,7 R | +8,9 R |

Le mode range de Nico perd à lui seul −128,8 et −199,7 R. RSI · Volume avec un seuil à 35 ou un volume à 1,2 perd aussi. Non retenus dans les mémos
et donc absents de Nico : déblocages de tokens (pas de données fiables), retest des V (le mémo 2 demandait de le prouver d'abord : pas régulier).
Moteur : options `big2`, `dz`, `nicoPts`, `sr` (fonction `srSetup`) ; rejeu : workflow `presets.yml`, script `tools/backtest/presets42.js`.
Étude de la même journée, non retenue : entrée « à la cassure » (branche `study-brk`, workflow `brk.yml`) : longs perdants, shorts irréguliers.

## Mise à jour du 26/11/2026 (2) : mémo 3 (vidéo « 6 stratégies », Le QG du Trading)

- Étiquette orange « Milieu de range, pas d'avantage » (score −4, rien de bloqué) : prix entre 40 et 60 % du plus haut et du plus bas des 48 dernières
  bougies 1H, moyennes 1H 20 et 50 à plat, pas de cassure. Rejeu, règles Radar : 3 % des trades seulement, et pas moins bons
  (2024-25 : 21 trades, −2 R ; 2025-26 : 18 trades, +9 R ; oct.-nov. 2026 : +3,6 R et +3,2 R). Étiquette d'information.
- « Confirmé » / « En formation · clôture dans X min » sur chaque « Prêt » : le setup relu sur les bougies 15 min clôturées seulement.
  Un « Prêt » vu en formation qui disparaît à la clôture affiche « Non confirmé » pendant 45 minutes. Rien ne change dans le statut ni le score.
Moteur : `midRange`, option `midTag`, `r.trigC` dans `enrich` ; workflow `mid.yml`, script `tools/backtest/mid42.js`.

## Mise à jour du 27/11/2026 : pause rebond activée

Bitcoin a pris +8,6 % en deux jours (57 250 → 62 200) : les quatre réglages, tous en short, ont perdu dans le Suivi (Radar 15 trades, 0 gagnant,
−15,8 R). Pause rebond activée (`REB=7`, tous les réglages) : pas de short « Prêt » quand Bitcoin est 7 % ou plus au-dessus de son plus bas de 72 h,
pas de long « Prêt » 7 % ou plus sous son plus haut de 72 h ; le setup reste visible en « À surveiller ». Rejeu (24/11) : novembre +86,4 → +121,7 R
(pire série 36 → 4), oct.-nov. +42,2 → +55,8 R, 2024-25 +27,8 → +67,0 R, 2025-26 +137,3 → +115,9 R.
Suivi : seules les bougies 15 min ouvertes après l'entrée comptent (celle en cours à l'entrée pouvait toucher le stop avant).
