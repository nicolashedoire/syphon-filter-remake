# French PS1 behavior audit

This report records evidence and gaps as of November 6, 2026. It is an investigation, not a claim of complete decompilation or behavioral parity. The user explicitly wants the current camera-follow behavior, targeting system and L2 lock / R2 fire bindings preserved. All other behavior is intended to match the original, but reconstruction must wait until its rules, missions and cinematics have been investigated.

## Evidence and confidence

- French disc `SCES-01911`; boot executable `SCES_019.11`, 1,824,768 bytes, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. The disc BIN SHA-256 is `c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72`.
- The [official French PlayStation manual](https://secure.cdn.us.playstation.com/manuals/classic/games/syphon-filter-manual-fr.pdf) describes player-facing controls, aiming, inventory and mission rules. It is evidence for documented behavior, not precise timings or AI implementation.
- REA 6.8.0 with Rizin 0.9.1 disassembled 120 instructions starting at `0x80069070` in the French executable; `work/rea-investigation/health-candidate-120.json` records the command, digest and output. Its association with damage is a candidate, not a verified function identification, complete decompilation, or runtime trace.
- The community port is a useful hypothesis generator, but its guest execution support identifies USA v1.1, not this French executable. Similar file names or decompiled C++ do not prove French behavior.
- Each offset below is a file offset in the named extracted file unless explicitly identified as a PS1 address. Text, resource names and extracted positions establish data presence; they do not establish activation order or behavior.

## Player controls and movement

| Area | Official or disc evidence | Current web behavior / gap |
|---|---|---|
| Controls | Default PS1: Square uses weapon, Circle rolls, Cross crouches/takes cover/descends, Triangle climbs/reloads/interacts/answers communications, L1 manual aim, R1 locks/cycles, L2/R2 lean, Select inventory, Start pause. | Custom controller mapping uses L2 lock and R2 fire as requested; crouch, cover, lean, climb, ledges and inventory are not yet implemented. |
| Locomotion | 151 resources are present in the embedded animation HOG at executable offset `0x89130`: 79 `.UPR`, 11 `.LWR`, 61 `.HAN`. See [the inventory](ps1-animation-inventory.csv): 150 resource extents are delimited by the next entry and hashed; the final entry has no verified end boundary, so its size and hash are omitted. Existence and filenames alone do not prove activation conditions. | Original idle, walk, run, aim, reload and 20-pose forward roll `STROL0.HAN` are rendered. Playback rates and movement across the ground are adapted, not verified original timings or root motion. |
| Combined movement | French resources include candidate walk/run and aim/reload variants; the US community port proposes separate upper/lower body layers. French runtime behavior still requires confirmation. | The current complete-body aim or reload pose takes priority over the gait, so a moving character can appear to slide. The gun attachment uses an approximate hand position, not the original joint orientation. |
| Timing | Original frame timings, interruption and collision rules are not established by the file names. | Roll duration 0.65 s, cooldown 1.2 s, minimum fire interval 0.28 s and reload time 1.1 s are prototype values, not verified PS1 values. |
| Aiming | The manual documents default, manual reticle and target-lock modes, target cycling and differences for one- and two-handed weapons. | Browser reticle, line-of-sight checks and L2 lock exist; precision gauge, target cycling and verified weapon-specific rules are missing. |
| Hanging / equipment | The manual documents ledge traversal, firing while hanging but no reload or weapon switch in that pose. It lists a silenced 9 mm, sniper rifle, taser and flashlight at the start. | These hanging and equipment systems are absent or not connected to playable behavior. |
| Health and armor | The manual states armor is depleted before health and armor can be replenished. The French weapon structure begins at `0xfd29c`; bytes at `0xfd2c8` are `8a 0c 19 10`, with decoded candidate fields 50, 25 and 4 matching a community interpretation. | `web/ps1-rules.js` contains provisional values; the actual hostile hit path in `web/game.js` subtracts one from a two-unit enemy health value, so those decoded damage fields do not currently drive enemy damage. Exact French calculations remain unverified. |

## Hostiles and ally

- Georgia actor `TERRO.HMD` source 184 has raw health 100 and five route points. CBDC actors 172 and 173 use `CHEMO.HMD`. These fields and waypoints do not prove the enemy's awareness or combat state machine.
- `SUBWAY2.BIN` SHA-256 `6ff2eb523e8e3ecb3647fde603571768af4ff79a09fb4d2c0e0cc1135b983e2b` has 12 `TERRO` actor records, sources 210–221, and nine non-empty routes. The original ally source 209 has raw health 350 and nine route points. Object table starts at `0x079c`; record 210 at `0x45f4`.
- The browser currently places 211–221; source 210 is rejected by its approximate collision grid. It assigns hostiles two hit units, alerts globally on the first hit, waits 3.5 s, and uses a 2.5 s firing interval and 7 damage units under its own distance, visibility and camera-facing checks. Patrol speed and stopping in combat are reconstructed. The metro ally is stationary with three hit units and a reconstructed warning/protection sequence.
- Original enemy geometry and idle/walk/run/death poses are used. The death pose is adjusted to the floor. A visible enemy weapon is not yet attached; shot tracers and flashes are reconstructed. Multiple named hit/death/surrender resources exist but have not been tied to verified French runtime transitions.
- The original detection cone, reactions to sound, cover choices, weapon logic, exact health and hit-location behavior are unresolved. Do not present the current simplified AI as decompiled original behavior.

## Mission and world state

The disc contains 20 FOG resources; only Georgia Street's training prototype and a reconstructed Destroyed Subway are playable. All 20 have geometry exports, but raw geometry is not a playable mission. [Level inventory](level-inventory.md) gives the community US catalog and explicitly distinguishes it from French runtime proof.

A read-only scan of 13 French `/BIN/*.OVL` files found 622 printable-byte sequences of at least six bytes; 213 passed a heuristic text filter. Those counts include possible false positives and broken strings. Multiple levels share an overlay, and the resource-to-record mapping comes from the US community catalog. Presence of an instruction does not establish its ordering, trigger, or actual objective state machine.

| French overlay | Examples of observed objective content and file offsets | Caveat |
|---|---|---|
| `SUBWAY.OVL` | bomb `0x2cc`; doors `0x2f0`; protect CBDC `0x320`; Kravitch and transmitter `0x340` | Georgia browser training is not the complete original mission. |
| `SUBWAY2.OVL` | passage/protect agent `0x210`; explosives `0x254`; preserve bombs/agent `0x278`, `0x294` | Browser sequence and two marked passages are reconstructed. |
| `SUBWAY3.OVL` | main subway label `0x218`; Aramov `0x244`; grenade warning `0x254` | Not playable. |
| `PARK.OVL`, `PARK2.OVL` | memorial/Marcos/hostages/bombs `0x21c–0x310`; Girdeux and grenade restriction `0x1b8`, `0x1c8` | Runtime order and conditions unverified. |
| `MUSEUM.OVL`, `MUSEUM2.OVL` | Phagan live capture/follow `0x260`, `0x27c`; live captures and constraints `0x154–0x190` | Not playable. |
| `BASEEXT.OVL`, `CHOPPER.OVL` | base, bunker and escape text `0x210`, `0x46c`, `0x61c`; helicopter and radar `0x364`, `0x388` | Shared overlays; one source string at `BASEEXT.OVL:0x8d0` is English even on this French disc. |
| `LEVSPEC.OVL`, `CATACOMB.OVL` | catacombs, researchers, antigen and hostages `0x454–0x564`; Lian/Phagan constraints `0x25c–0x2f4` | Text is not a runtime trace. |
| `WHOUSE.OVL`, `CAVE.OVL` | warehouses, gates, elevator and timer `0x744–0x804`; silo, power and missile constraints `0x774–0x8c4` | These overlays cover multiple resources; attribution remains to be verified. |

A second pass indexed all 22 date anchors and matched the 20 community catalog record indices to adjacent French title candidates. See [the 20 candidate briefing records](ps1-briefing-candidates.csv). All 20 candidate records have a date and adjacent French label, but the catalog indices are still US-port mappings and two extra date anchors demonstrate that date anchors are not necessarily one-to-one with missions. This is a data cross-check, not proof of runtime selection or trigger order.

The community briefing parser expects a `HH:MM` time, while the 22 date strings found in the French overlays use `h`, for example `23h45` (`SUBWAY2.OVL:0x1dc`). Applying that parser unchanged is therefore not sufficient for French records. A standalone `/BIN/SUBWAY3.OVL` exists even though a similarly named FOG archive contains another overlay copy.

The manual also describes mission objectives and parameters, mission updates, maps, radio communications and checkpoints. The web save system is a browser-specific reconstruction, not an emulation of the PS1 save system.

## New controlled runtime observation

A manual RetroArch / PCSX ReARMed HLE run reached a controllable French Georgia Street mission: forward movement and pistol ammunition consumption were observed, alongside the initial objective screen and two armed characters. [Runtime observations and model-record inventories](ps1-georgia-runtime-observations.md) document the test and remaining limits. This does not yet establish enemy AI, timing, damage rules or full mission parity.

## Further all-level investigation

- The [mission-objective evidence map](ps1-mission-objectives-evidence.md) covers all 20 candidate resources and distinguishes shared text pools from confirmed runtime objectives. Five FOG DLF payloads duplicate a different overlay from the expected briefing candidate.
- The [roll investigation](ps1-roll-investigation.md) measures five bounded candidate clips and documents REA/Ghidra code observations without claiming runtime timing or activation.
- The [actor investigation](ps1-actor-investigation.md) inventories records for all 20 levels and links a candidate object routine to the candidate weapon table; the counts are not proof of enemy identity or spawn behavior.

## Latest REA, Ghidra and runtime work

- [Animation selection](ps1-animation-selector-investigation.md) traces a generic indexed selector, without mapping a roll clip to a runtime index. A [new isolated Georgia run](ps1-roll-runtime-observation.md) observed a roll and captured intermediate poses; timing and other mission scenarios remain unverified.
- [Actor decision candidate](ps1-actor-decision-investigation.md) documents an object-related counter and conditional BIOS call, without identifying it as a verified enemy behavior.
- [Objective descriptor investigation](ps1-objective-descriptor-investigation.md) links two French overlay descriptors to code and surveys 13 overlays; it does not establish runtime triggers or completion rules. The [runtime coverage table](ps1-runtime-mission-coverage.csv) distinguishes the single mission with an observed initial objective menu from the other 19.
- [Objective mask and actor-link investigation](ps1-objective-mask-investigation.md) documents distinct candidate descriptor bitfields and cross-checks static class/link data against code in three overlays. Runtime event meanings remain unknown.
- [Actor audio-path investigation](ps1-actor-audio-investigation.md) follows one candidate decision branch into an ID selector and conditional PS1 audio-register writes. It does not establish a grenade action, enemy reaction or sound identity.
- A [mission-selection experiment](ps1-mission-select-experiment.md) did not unlock additional levels; Georgia remains the only mission with its original objective menu observed in this emulator.
- An [isolated DuckStation session](ps1-duckstation-runtime.md) reached Georgia, accepted movement, and restored a saved state without restarting. This one trial does not establish full emulator compatibility or long-term stability.

## Additional investigation

- The [cinematic and audio inventory](ps1-cinematics-inventory.md) records all 39 STR files, audio metadata and gaps in the web version. Playback triggers and spoken language have not been established.
- The [Ghidra cross-check](ps1-ghidra-cross-check.md) independently decompiled one candidate MIPS routine and records a new REA pointer-structure investigation.
- The [combat-table investigation](ps1-combat-static-investigation.md) documents REA observations, 26 candidate records and the unverified enemy-AI questions.
- The [runtime investigation](ps1-runtime-investigation.md) records emulator and CPU-probe results; a bootable, instrumented French runtime remains necessary to establish gameplay behavior.

## Verification plan before gameplay changes

1. Capture controlled scenarios on the French release and measure frame timing, positions, aiming, controls, enemy detection, reactions, damage and mission transitions. Record emulator/debugger version, disc/executable hashes and repeatable inputs.
2. Map observed runtime values and code paths to the French executable and mission overlays. Verify function identities and disassembly against runtime traces; treat the US project only as a candidate map.
3. Build scenario-based regression tests with observed start state, inputs and expected outcomes. Separate user-requested deviations such as L2/R2 mapping from original mechanics.
4. Implement one verified behavior at a time and document evidence, gaps and visual checks. Do not claim all original behavior has been recovered from data files or names alone.
