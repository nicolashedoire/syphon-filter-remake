# Recherche technique — édition française PS1

## Disque étudié

L'image `Syphon Filter (France).zip` de la [collection PlayStation Redump d'Internet Archive](https://archive.org/details/ef_Sony_PlayStation1_Redump_Collection_4of4) a été téléchargée et son SHA-1 correspond aux métadonnées de la notice : `e72ca31e6f8438469ed7b358a17c8573dfb26b64`. Son CUE/BIN indique le volume `SCES01911` et le fichier `SYSTEM.CNF` démarre `SCES_019.11`. L'image et les fichiers du jeu ne sont pas inclus dans ce dépôt.

L'archive `/FOG/SUBWAY.FOG` est lisible et comprend 14 entrées ; `WLDEMD.HOG` contient 91 modèles EMD. Les outils du dépôt les ont tous convertis localement en OBJ : 32 323 sommets et 36 021 triangles. Ces nombres concernent la géométrie uniquement ; les textures, objets animés et interactions restent à étudier.

## Analyse REA

Le 6 novembre 2026, [REA](https://github.com/morluto/rea) 6.8.0 avec Rizin 0.9.1 a inspecté localement l'exécutable PS-X EXE extrait `/SCES_019.11`. Sa taille est de 1 824 768 octets et son SHA-256 est `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. L'analyseur générique de REA ne reconnaît pas directement le format PS-X EXE, mais son outil `execute-rizin-command` permet de désassembler le MIPS 32 bits little-endian.

Le point d'entrée observé est `0x800e44b4` ; 32 instructions y ont été désassemblées. Le début montre notamment une boucle d'écriture de zéros puis une préparation de la pile, ce qui suggère une initialisation du programme. **Cela ne démontre pas encore le fonctionnement des mécaniques du jeu.** L'exécutable n'a pas été modifié. Les fichiers de preuve détaillés restent locaux.

## Prochaines étapes

- Comparer les adresses et overlays français avec la version américaine utilisée par SF-pc-port.
- Reconstituer les textures et leur correspondance avec les polygones, puis les objets et animations.
- Étudier les collisions, contrôles et scripts de mission avant de parler de scène jouable fidèle.
