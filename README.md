# Syphon Filter — recherche et prototype de remake

Ce dépôt rassemble les premières étapes d'un projet non officiel de remake francophone du premier *Syphon Filter* sur PlayStation. Le code source original d'Eidetic n'a pas été trouvé ; les sources communautaires ci-dessous sont des travaux distincts. Le remake 3D et sa traduction française ne sont pas encore réalisés.

## Sources PS1 et port PC récupérés

Les deux projets sont référencés sous forme de sous-modules Git, à une version précise, avec leur historique et leurs notices conservés dans leurs dépôts respectifs :

- [`references/syphon-filter-xport`](https://github.com/psxports/SyphonFilter-xport) : projet de décompilation du jeu PS1 en C. Il est expérimental ; son degré d'achèvement et sa compilation n'ont pas été vérifiés. Son code mentionne la version américaine v1.0.
- [`references/sf-pc-port`](https://github.com/Madxbio97/SF-pc-port) : port PC Windows non officiel. Il utilise du code du jeu PS1 avec un environnement d'exécution PC et annonce une campagne de 20 missions. Pour jouer, il demande une image BIN/CUE de **Syphon Filter USA NTSC-U v1.1**, numéro SCUS-94240. La compilation du projet ne nécessite pas cette image. L'interface du port est en anglais ou en russe.

Pour récupérer ce dépôt avec les deux projets :

```sh
git clone --recurse-submodules https://github.com/nicolashedoire/syphon-filter-remake.git
```

Si le dépôt est déjà cloné :

```sh
git submodule update --init --recursive
```

Les licences des projets, dépendances et éléments graphiques doivent être consultées dans leurs dépôts respectifs. Une licence sur du code communautaire ne donne pas automatiquement les droits sur les données du jeu original. Ce dépôt ne contient aucune image de disque PS1.

## Français et version d'origine

Sony publie un [manuel officiel en français](https://secure.cdn.us.playstation.com/manuals/classic/games/syphon-filter-manual-fr.pdf) identifié SCES-01911. L'édition française PS1 est une piste pour retrouver les textes et l'ambiance. Sa compatibilité avec les projets ci-dessus n'est pas établie : ils ciblent des versions américaines différentes.

Étapes à étudier : prise en charge de la version française ou traduction du port ; restitution et validation des menus, briefings et textes en français ; puis améliorations visuelles et de gameplay pour construire un remake fidèle. Les voix et cinématiques dépendent également de la version du jeu utilisée.

La [recherche Internet Archive](https://archive.org/search?query=syphon+filter&tab=all) contient notamment des images de jeu, vidéos et modèles ; aucune source officielle de développement n'a été identifiée dans les notices consultées.

## Prototype indépendant

Le prototype initial « Opération Sillage » reste disponible : ouvrir `index.html` dans un navigateur récent sur ordinateur. Il s'agit d'une mission en vue de dessus inspirée de l'infiltration, pas d'une reproduction du jeu PS1.

- **ZQSD** ou **flèches** : se déplacer ; **souris** : viser et tirer.
- **Maj** : marcher discrètement ; **E** : interagir ; **R** : recharger.

Projet non officiel, sans affiliation avec les ayants droit de Syphon Filter.
