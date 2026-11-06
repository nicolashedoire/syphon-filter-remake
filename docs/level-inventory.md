# French PlayStation campaign inventory and remake gap

## Scope and evidence

The source is the original French disc `SCES-01911`, boot executable `SCES_019.11` (SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`). `tools/inspecter_disque_ps1.py` finds **20 FOG files** in `/FOG`; all 20 were opened with `tools/archives_syphon.py`, and each contained a parseable `WLDEMD.HOG` with the EMD counts below. The counts are world model files, not a measure of campaign completion, objects, or playable rooms.

Campaign order, the English level names below, resource identifiers and overlay names are from the independent community US PC port's [`mission.cpp`](../references/sf-pc-port/src/game/mission.cpp). All 20 corresponding FOG filenames and overlays occur on the French disc, but an identical filename does not prove binary or behavior parity between the French and US releases. French `DLF.RFF` briefing strings were also observed inside the French FOG files; several adjacent resources share the same briefing. A shared briefing must not be mistaken for that level's unique title or objectives.

| # | Community campaign name | French disc resource | Overlay listed in US port | EMD models | Remake state |
|---:|---|---|---|---:|---|
| 1 | Georgia Street | `SUBWAY.FOG` | `SUBWAY.OVL` | 91 | Partial 3D training prototype |
| 2 | Destroyed subway | `SUBWAY2.FOG` | `SUBWAY2.OVL` | 23 | Playable reconstruction; original mission logic incomplete |
| 3 | Main subway line | `SUBWAY3.FOG` | `SUBWAY3.OVL` | 23 | Geometry export validated; not playable |
| 4 | Washington Park | `PARK.FOG` | `PARK.OVL` | 75 | Geometry export validated; not playable |
| 5 | Freedom Memorial | `PARK2.FOG` | `PARK2.OVL` | 4 | Geometry export validated; not playable |
| 6 | Expo Center Reception | `MUSEUM.FOG` | `MUSEUM.OVL` | 43 | Geometry export validated; not playable |
| 7 | Expo Center Dinorama | `MUSEUM2.FOG` | `MUSEUM2.OVL` | 19 | Geometry export validated; not playable |
| 8 | Rhoemer's Base | `BASEEXT.FOG` | `BASEEXT.OVL` | 61 | Geometry export validated; not playable |
| 9 | Base Bunker | `BUNKER.FOG` | `BASEEXT.OVL` | 20 | Geometry export validated; not playable |
| 10 | Base Tower | `CHOPPER.FOG` | `CHOPPER.OVL` | 3 | Geometry export validated; not playable |
| 11 | Base Escape | `BASEEXT2.FOG` | `BASEEXT.OVL` | 61 | Geometry export validated; not playable |
| 12 | Rhoemer's Stronghold | `CHURCH.FOG` | `LEVSPEC.OVL` | 67 | Geometry export validated; not playable |
| 13 | Stronghold lower level | `CHURCH2.FOG` | `LEVSPEC.OVL` | 58 | Geometry export validated; not playable |
| 14 | Stronghold catacombs | `CATACOMB.FOG` | `CATACOMB.OVL` | 95 | Geometry export validated; not playable |
| 15 | PHARCOM warehouses | `WHOUSE.FOG` | `WHOUSE.OVL` | 62 | Geometry export validated; not playable |
| 16 | PHARCOM elite guards | `WHOUSE2.FOG` | `WHOUSE.OVL` | 34 | Geometry export validated; not playable |
| 17 | Warehouse 76 | `INWHOUSE.FOG` | `WHOUSE.OVL` | 34 | Geometry export validated; not playable |
| 18 | Silo access tunnels | `CAVE.FOG` | `CAVE.OVL` | 32 | Geometry export validated; not playable |
| 19 | Tunnel blackout | `CAVE2.FOG` | `WHOUSE.OVL` (briefing: `CAVE.OVL`) | 14 | Geometry export validated; not playable |
| 20 | Missile Silo | `SILO.FOG` | `WHOUSE.OVL` (briefing: `CAVE.OVL`) | 12 | Geometry export validated; not playable |

As a cross-check, the first French `DLF.RFF` entries include `Métro détruit` in `SUBWAY2`, `Parc de Washington` in `PARK`, `Mémorial de la Liberté` in `PARK2`, `Réception de l'Exposition` in `MUSEUM` and `Exposition Dinorama` in `MUSEUM2`. These are disc text labels, not translations added by this project. Initial entries in archives such as `SUBWAY3` reuse the Georgia Street briefing; `CAVE`, `CAVE2`, and `SILO` begin with the warehouse briefing. The community implementation reads the authoritative briefing from the selected overlay and record, and uses DLF as a fallback. Those initial strings alone therefore do not establish the briefing for each mission. The standalone mission labels in the table above are identified by the US catalogue, pending independent French runtime verification.

## What the browser currently reproduces

| Area | Original evidence | Browser state and remaining gap |
|---|---|---|
| Campaign | 20 resource/overlay combinations listed above | Georgia Street training and a Destroyed Subway reconstruction; no retail campaign progression or remaining 18 playable missions. |
| Geometry | Each French FOG has an EMD world archive and mission data | Georgia Street terrain and selected objects are rendered; all other archives have been exported as raw geometry locally. Texture streaming, room transitions and collisions need further validation. |
| Actors and AI | French `SUBWAY.BIN` includes terrorist source 184 and CBDC sources 172/173; other authored actors and overlays exist | One terrorist follows its authored route with approximate movement and alert rules. The other nearby targets and combat AI are provisional. The protected CBDC are not yet functional mission actors. |
| Missions | Original French briefing, mission data and overlays exist; the US community port contains a partial readable mission implementation | The French Georgia Street briefing is displayed and some event logic has tests, but the retail objective chain, doors, bomb handling, reinforcements, allies, fail states and checkpoints are not fully connected or validated. |
| Animation and combat | Original meshes and animation clips have been extracted; a weapon table has been found in the French executable | Gabe idle/walk/run, aiming and reload plus terrorist cycles are adapted. Weapon attachment and enemy reactions remain approximate; original AI, aiming, cover, all weapons and all animation transitions are incomplete. |
| Presentation | French disc contains title assets, intro movies, subtitles/briefings and other audio resources | Title, selected intros, French Georgia Street briefing and HUD are present. Most in-game voices, mission-specific text and later cinematics still need extraction and integration. |
| Save and controls | Original contains PlayStation menu, controller support and save behavior | Browser keyboard/controller handling and a local save system are separate adaptations; their behavior is not yet claimed as PS1 parity. |

These gaps concern an unofficial reconstruction. The game's original source code has not been found, and neither an extracted archive nor a decompiled/disassembled function is by itself proof of a complete mission implementation.

## Destroyed subway terrain asset

`web/assets/subway2-textured.js` is an independently loadable terrain dataset exported from the French `SUBWAY2.FOG`; it exposes `window.SF_SUBWAY2_TERRAIN` without replacing the Georgia Street scene. It contains 12,349 textured triangles, 23 room ranges, 20 material combinations, an embedded PNG atlas, the room-visibility table and initial visibility room 19. The corresponding exporter is reproducible with:

```sh
python3 tools/export_subway2_web.py 'game-disc/Syphon Filter (France).cue' web/assets/subway2-textured.js
node tests/test_subway2_terrain.cjs
```

The output must not already exist; Pillow, a C++20 compiler and the initialized `sf-pc-port` submodule are required to regenerate it. The terrain is now integrated as the Destroyed Subway playable reconstruction. The separate `web/metro-data.js` contains the French disc's player position and 12 `TERRO.HMD` records with patrol waypoints from `SUBWAY2.BIN`; one hostile position is currently rejected by the approximate collision grid. `CHEMO.HMD` is the CBDC ally. The French objective labels in `SUBWAY2.OVL` include locating explosives, protecting the CBDC agent, opening the passage, and not damaging bombs or killing the ally.

The mission interactions are provisional: a marked pickup at the original TNT trigger, a stationary ally at its original spawn, a simplified explosive, two explicitly marked transitions across impassable geometry, and a reconstructed objective sequence. The original scripts, geometry-specific collision, ally behavior, explosion, combat rules and animations have not been recovered or validated as equivalent. Enemy health and AI behavior are approximations. After the player contacts the ally, nearby guards with line of sight can attack them after a grace period; this guard behavior and the failure condition are reconstructed, not verified PS1 code. The local subway save is isolated from the Georgia Street save. `tests/test_metro_mission.cjs` tests the objective interactions, save/resume and collision connectivity within each area.

## Reproducible geometry export

With the French CUE/BIN, a C++20 compiler and the `sf-pc-port` submodule initialized:

```sh
python3 tools/export_level_geometry.py 'game-disc/Syphon Filter (France).cue' SUBWAY2 work/subway2-export
```

The destination must not exist. The tool copies no data back to the disc, parses the named mission's `WLDEMD.HOG`, writes individual `.obj` files, a merged OBJ and a JSON count. All 20 geometry exports were verified on the French image: 831 model entries, 309,251 vertices and 359,937 triangulated faces in total across archives (shared assets can be counted more than once). The `SUBWAY2` run contains: **23 models, 11,110 vertices and 12,349 triangulated faces**. These are raw geometry: textures, animated objects, actors, collision rules, controls, objectives and audio are absent. The existing `visualiseur/index.html` can inspect the generated OBJ; it does not turn it into a playable level.

`tests/test_export_level_geometry.py` validates resource-name safety and performs the `SUBWAY2` extraction when the actual disc, compiler and reference parser are available; the real-disc test otherwise skips. Further work must replace the provisional transitions, actors, hazards and objective sequence with independently verified behavior from the French release.
