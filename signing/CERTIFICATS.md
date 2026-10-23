# Signature de l'APK

Depuis la version 42, l'appli est signée avec une nouvelle clé. L'ancienne clé était publique dans ce dépôt (`radar.keystore`,
mot de passe dans `app/build.gradle`) : n'importe qui pouvait signer un APK reconnu comme une mise à jour.

| Clé | Rôle | Empreinte SHA-256 du certificat |
|---|---|---|
| Ancienne clé, `radar.keystore` (RSA, « CN=Radar Trades ») | Signature v2 pour Android 8 ; premier maillon de la rotation | `FA:32:2B:2C:ED:9E:40:E2:B1:E0:DD:48:4E:BB:A4:D4:11:FA:7A:64:1C:96:34:2A:9F:3A:FB:05:F8:B4:E5:DC` |
| Clé 2026 (EC P-256, alias `radar2026`, « CN=Radar Trades 2026 ») | Signature v3 pour Android 9 et plus | `93:4D:F6:E6:A0:A7:69:88:C0:19:6A:09:26:35:BC:35:ED:7A:CF:30:2B:80:43:62:CE:38:04:C4:E8:F3:06:B9` |

## Où est la clé 2026

Dans le secret GitHub `RADAR_SIGNING_KEY` du dépôt (fichier PKCS12 en base64), et dans la copie de sauvegarde qu'Amine conserve.
Elle n'est jamais écrite dans le dépôt. Le workflow la décode dans un dossier temporaire du runner et l'efface après signature.

**Sans le secret, la compilation s'arrête** à l'étape « Signing key present » : aucun APK n'est publié, aucune clé n'est créée à
la place (l'ancienne version générait une clé en silence quand le fichier manquait).

## Rotation de clé

`apksigner rotate` produit une preuve, signée par l'ancienne clé, que la clé 2026 lui succède (lineage). L'APK est signé avec les
deux clés et cette preuve, `--rotation-min-sdk-version 28` :

- Android 9 et plus (API 28+) : bloc de signature v3 de la clé 2026, avec la lineage ancienne → 2026. La version 42 s'installe
  par-dessus la version 41 sans désinstallation : données, réglages et clés API (coffre Android Keystore) sont conservés.
- Ensuite, un APK signé seulement avec l'ancienne clé est refusé comme mise à jour : la capacité « rollback » n'est pas accordée
  à l'ancienne clé dans la lineage (capacités 0x17 : données installées, UID partagé, permissions, authentification).
- Android 8 (API 26-27) : bloc v2 de l'ancienne clé. Sur ces versions, l'ancienne clé publique reste acceptée : c'est la limite de
  la méthode, sans effet sur un téléphone récent.

## Vérifier un APK

Avec les outils Android : `apksigner verify -v --print-certs radar-trades.apk` puis `apksigner lineage --in radar-trades.apk --print-certs`
(cette sortie est jointe à chaque release, fichier `signature.txt`).

Sans outil Android : `python3 tests/apk_sigs.py radar-trades.apk` lit le bloc de signature et affiche :

```
v2       toutes versions de la v2           fa322b2ced9e40e2b1e0dd484ebba4d411fa7a641c96342a9f3afb05f8b4e5dc
v3       Android SDK 28 à max               934df6e6a0a76988c0196a092635bc35ed7acf302b804362ce3804c4e8f306b9
lineage  maillon 1, capacités 0x17 (sans rollback) fa322b2ced9e40e2b1e0dd484ebba4d411fa7a641c96342a9f3afb05f8b4e5dc
lineage  maillon 2, capacités 0x17 (sans rollback) 934df6e6a0a76988c0196a092635bc35ed7acf302b804362ce3804c4e8f306b9
```

## Si la mise à jour était refusée

Rien n'est perdu : la version 41 reste installée. Repli prévu : une version « pont » signée avec l'ancienne clé seule s'installe par
dessus la version 41 ; elle contient l'export des données (Réglages et sauvegarde › Exporter mes données). Ensuite : désinstaller,
installer la version 42, importer la sauvegarde, ressaisir les clés API (elles ne sont jamais exportées).
