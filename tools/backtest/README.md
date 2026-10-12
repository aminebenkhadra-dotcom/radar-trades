# Test du moteur sur l'historique

Ces scripts rejouent le moteur de l'appli sur des données Binance passées. Ils ne font pas partie de l'APK.

- `fetch.js` télécharge l'historique public (data.binance.vision) : bougies 15 minutes, funding, positions ouvertes et ratios
  long/short des 60 contrats les plus échangés au début de la période. Il tourne dans GitHub Actions (`backtest.yml`, sur la
  branche `backtest-run`) et range le résultat dans la branche `backtest-data`.
- `ref.js` puis `refrep.js` : le test de référence. Ils utilisent le même code que le bouton « Test sur l'historique » de
  l'appli (`btStart`, `btStep` dans `tools/engine.js`).
- `baseline.js`, `engine_v2.js`, `report.js` : le moteur de la version 19, pour comparaison.
- `gen.js`, `engine_research.js`, `study.js`, `s*.js`, `t1.js`, `pos.js`, `export.js` : la recherche de critères. `gen.js`
  construit un tableau de toutes les situations où le prix est sur une zone, avec une centaine de mesures ; les autres
  scripts cherchent lesquelles séparent les bons trades des mauvais sur novembre à mai, puis vérifient sur juin à octobre.
- `gen2.js`, `study2.js`, `study3.js` : le même travail avec le moteur livré ; filtres de tendance du marché (Bitcoin, Ether,
  largeur du marché) et objectifs plus proches. Ils ont été lancés sur une seconde année, octobre 2024 à octobre 2025
  (`START=2024-09 END=2025-10 node fetch.js klines <dossier>`), qui n'avait servi à aucun réglage.
- `chk.js`, `chk2.js` : contrôles du banc de test lui-même (un filtre qui triche avec le futur doit gagner ; les données de
  flux horodatées T décrivent les minutes après T et doivent être décalées).

```
node tools/backtest/ref.js <données> <sortie> 2 0/2 & node tools/backtest/ref.js <données> <sortie> 2 1/2 & wait
node tools/backtest/refrep.js <sortie> ref-2
```

Méthode : entrée au prix de clôture de la bougie 15 minutes où le setup devient « Prêt », sortie au stop ou à TP1 (stop
d'abord si les deux sont touchés dans la même bougie), un seul trade à la fois par crypto, 0,05 % de frais par côté et
0,02 % de glissement. Le carnet d'ordres n'est pas rejoué, faute d'historique.
