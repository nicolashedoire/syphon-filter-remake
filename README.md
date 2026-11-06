# Syphon Filter — Remake Research and Prototype

This repository contains the first steps toward an unofficial French-language remake of the original PlayStation *Syphon Filter*. Eidetic's original source code has not been found; the community projects referenced below are separate efforts. The 3D remake and its French localization have not yet been completed.

## Play the HTML prototype

**[Play the browser prototype online](https://nicolashedoire.github.io/syphon-filter-remake/)**

Open `index.html` directly in a recent desktop browser with WebGL enabled. The game uses local HTML, CSS, and JavaScript; it does not require a server, a build step, a disc image, or an internet connection after the repository files are downloaded.

- **Z / S** (or up / down arrows): move forward / backward.
- **Q / D** (or left / right arrows): turn the character; the camera follows.
- **Mouse**: look around; **left click or Space**: shoot. A red diamond identifies a visible enemy.
- **E**: examine a nearby defeated enemy or recognized mission mechanism; some mechanisms are not yet functional.
- **R**: reload; **Shift**: walk; **Escape**: release the pointer; **H**: open the PC controls guide.
- **PlayStation controller** (standard browser mapping): on the title screen use the directional pad or left stick to select, and Cross or Options to confirm. During play, the left stick moves and turns, the right stick moves the aiming reticle, pressing R3 recenters it, R2 fires, Square reloads, Cross interacts, and Options opens or closes the guide. Press a controller button first so the browser can detect it; the title screen shows the detection status. Controller availability depends on the browser and operating system.
- The original intro movies can be skipped; the French mission briefing is shown before gameplay.

This is an early playable 3D prototype, not a complete remake. It uses the original title video and French menu sprite, the starting point, level geometry, PS1 textures, original Gabe and terrorist models, original aiming, reload and movement animation poses, the original silenced handgun, and selected street objects from the French disc. The handgun follows the animated hand using an approximate attachment; its original joint orientation remains to be recovered. It plays the two original intro videos and displays the original French briefing before the mission. The intro video audio comes from the French disc; its spoken language has not been independently verified. The title video is muted for browser autoplay.

A controls guide opens before the first mission and can be reopened with H or Options; the game pauses while it is open. Enemies do not attack until the player hits one; an alert and short delay precede retaliation. This is a temporary playability safeguard, not a verified PS1 rule. One enemy follows a route extracted from the French disc, while its patrol speed and combat behavior are approximations; two nearby targets and the three-enemy training objective are provisional. The other camera, shooting and collision behavior is also newly implemented. A first mission-state port exists in `web/mission.js`: interaction locations can be recognized, but their mechanisms and authentic actors are not yet connected to playable mission progression. Dynamic texture changes, complete character animations, in-game voices and the rest of the game are also not yet implemented.

## French PS1 Disc Image

**[Open the French PS1 disc image (BIN and CUE)](game-disc/)** — Syphon Filter, French edition SCES-01911. The BIN contains the disc data (697 MB); the accompanying CUE describes the disc track.

The French SCES-01911 disc image is stored in `game-disc/` as a BIN/CUE pair. The BIN file is tracked with [Git LFS](https://git-lfs.com/) because it exceeds GitHub's regular file size limit. Install Git LFS before cloning; for an existing clone run `git lfs install` and `git lfs pull` to download the image. Keep the BIN next to its CUE file.

Git LFS storage and public downloads count toward the repository owner's quota and may incur charges if the included allowance is exceeded.

## Initial Work on the French Disc

The French PS1 edition, **SCES-01911**, was identified using its `SYSTEM.CNF` file. On this disc image, `/FOG/SUBWAY.FOG` contains `WLDEMD.HOG` and its 91 environment models for the first area. All 91 models were converted locally: 32,323 vertices and 36,021 triangles. The converted geometry is included as `web/assets/georgia-street.js` for the standalone HTML prototype.

A raw geometry viewer is available at `visualiseur/index.html`: open the page in a browser and choose the generated OBJ files. You can rotate and zoom the scene. This separate viewer shows the geometry only, without textures, characters, animations, or gameplay.

The tools `tools/inspecter_disque_ps1.py`, `tools/archives_syphon.py`, and `tools/exporter_emd_obj.cpp` inspect the local disc image, FOG/HOG archives, and EMD geometry. The EMD parser comes from the SF-pc-port project referenced below. To reproduce the export from a local CUE/BIN image, using Python 3 and a C++20 compiler (`clang++` or `c++`):

```sh
mkdir -p work
python3 tools/preparer_geometrie.py "game-disc/Syphon Filter (France).cue" work/geometry
```

The destination directory must not already exist, and its parent must exist. The resulting `work/geometry/georgia-street.obj` and individual OBJ files can be opened in the viewer. The tool does not modify the source image.

Run the tests with:

```sh
python3 -m unittest discover -s tests -v
for test in tests/*.cjs; do node "$test"; done
```

See [docs/french-ps1-research.md](docs/french-ps1-research.md) for details on these initial findings and the REA analysis.

## Recovered PS1 Sources and PC Port

The two projects are referenced as Git submodules at pinned revisions, with their histories and notices preserved in their respective repositories:

- [`references/syphon-filter-xport`](https://github.com/psxports/SyphonFilter-xport): a C decompilation project for the PS1 game. It is experimental; its degree of completion and build process have not been verified. Its code references the US v1.0 release.
- [`references/sf-pc-port`](https://github.com/Madxbio97/SF-pc-port): an unofficial Windows PC port. It uses PS1 game code with a PC runtime and advertises a 20-mission campaign. Playing it requires a BIN/CUE image of **Syphon Filter USA NTSC-U v1.1**, serial number SCUS-94240. The image is not required to compile the project. The port's interface is available in English or Russian.

To clone this repository with both projects:

```sh
git clone --recurse-submodules https://github.com/nicolashedoire/syphon-filter-remake.git
```

If the repository is already cloned:

```sh
git submodule update --init --recursive
```

Consult the respective repositories for the licenses of each project, dependency, and visual asset. A license covering community code does not automatically grant rights to the original game data.

## French Language and Original Release

Sony provides an [official French manual](https://secure.cdn.us.playstation.com/manuals/classic/games/syphon-filter-manual-fr.pdf) identified as SCES-01911. The French PS1 edition provides a reference for the text and atmosphere. Its compatibility with the projects above has not been established: they target different US releases.

Work remains to restore the original French mission scripts, dialogue and in-game voices, and to validate the gameplay against the PS1 release.

The [Internet Archive search](https://archive.org/search?query=syphon+filter&tab=all) includes game images, videos, and models. No official development source code was identified in the records examined.

## Independent Prototype

The initial prototype, “Opération Sillage,” remains available: open `prototype.html` in a recent desktop browser. It is a top-down stealth mission inspired by the genre, not a reproduction of the PS1 game.

- **ZQSD** or **arrow keys**: move; **mouse**: aim and shoot.
- **Shift**: walk stealthily; **E**: interact; **R**: reload.

This is an unofficial project with no affiliation to the rights holders of Syphon Filter.
