# French PS1 mission-objective evidence: all 20 catalog resources

## Method and limits

The source is the local SCES-01911 French disc BIN, SHA-256 `c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72`. Level ordering, FOG resource names and expected standalone briefing-overlay pairings come from `references/sf-pc-port/src/game/mission.cpp`, a community US project, and its 20-record cross-check in `docs/ps1-briefing-candidates.csv`. They are hypotheses about the French runtime, not proof of its campaign sequencing. All byte offsets below refer to the standalone French `/BIN/*.OVL` files, unless explicitly called a DLF offset.

In a prior French gameplay test, Georgia Street's objectives menu showed eliminating Kravitch and destroying the transmitter, plus eliminating Rhoemer. That is a direct observation of that moment. The additional Georgia strings below are present in the disc but their timing and triggers are not proven. All other titles, objective meanings, per-level text associations and event conditions in this report require French runtime validation. A brief string could describe a failed condition, intermediate goal, status or completed goal; text alone cannot decide.

Each sector-padded `DLF.RFF` from the 20 locally read `FOG` archives was hashed and compared with all 13 candidate standalone briefing overlays. `audit_french_mission_containers.py` records the exact byte matches and candidate date/title occurrences without editing the disk. The community-parser header interpretation provides the candidate text boundaries. Long identical byte runs may include MIPS code as well as text: they establish duplication, not that the engine invokes any particular code or displays any specific objective.

## Resource-by-resource candidate map

The listed date and title are the French strings next to the candidate record in its standalone overlay. "Shared pool" means the overlay supplies objective-related strings near multiple briefing records; without code or runtime observation, the strings are **not assigned individually** to the listed levels.

| # | Resource | Candidate French title and time | Standalone overlay | Objective evidence and unresolved scope |
|---:|---|---|---|---|
| 1 | `SUBWAY` | Georgia Street, 08/23 22h45 | `SUBWAY.OVL` | Bomb in terminal (`0x2cc`), door terminal (`0x2f0`), CBDC protection (`0x320`), Kravitch/transmitter (`0x340`), constraints (`0x36c`, `0x3a8`). Kravitch/transmitter directly observed in the mission menu; the other strings' timing is unknown. |
| 2 | `SUBWAY2` | Métro détruit, 08/23 23h45 | `SUBWAY2.OVL` | Open passage/protect CBDC (`0x210`), find explosives (`0x254`), preserve bombs and agent (`0x278`, `0x294`). Runtime conditions unknown. |
| 3 | `SUBWAY3` | Ligne principale du métro, 08/24 00h30 | `SUBWAY3.OVL` | Aramov (`0x244`) and grenade/rail constraint (`0x254`). FOG DLF instead duplicates `SUBWAY.OVL`; runtime source selection unknown. |
| 4 | `PARK` | Parc de Washington, 08/24 00h45 | `PARK.OVL` | Memorial, Marcos, transmitter, hostages (`0x21c–0x280`); bomb time limit and constraints (`0x2c0–0x310`). Order and values at runtime unverified. |
| 5 | `PARK2` | Mémorial de la Liberté, 08/24 01h15 | `PARK2.OVL` | Girdeux (`0x1b8`), grenade restriction (`0x1c8`). Runtime unverified. |
| 6 | `MUSEUM` | Réception de l’Exposition, 08/25 19h00 | `MUSEUM.OVL` | Live capture/follow Phagan (`0x260`, `0x27c`) and stealth/live-capture constraints (`0x2a0`). Runtime unverified. |
| 7 | `MUSEUM2` | Exposition Dinorama, 08/25 19h15 | `MUSEUM2.OVL` | Capture Aramov/Phagan alive (`0x154`) and survival constraints (`0x17c`, `0x190`). Runtime unverified. |
| 8 | `BASEEXT` | Base de Rhoemer, 09/01 21h00 | `BASEEXT.OVL` | Shared base pool `0x630–0x888`, detailed below; per-level activation unverified. |
| 9 | `BUNKER` | Bunker de la base, 09/01 21h30 | `BASEEXT.OVL` | Same shared base pool; record index/selection unverified. |
| 10 | `CHOPPER` | Tour de la base, 09/01 21h40 | `CHOPPER.OVL` | Attack helicopter (`0x364`) and radar detector (`0x388`). Overlay also has another date marker (`09/01 21h41`) which is not assumed to be a mission. |
| 11 | `BASEEXT2` | Fuite de la base, 09/01 21h45 | `BASEEXT.OVL` | Same shared base pool; record index/selection unverified. |
| 12 | `CHURCH` | Forteresse de Rhoemer, 09/07 06h30 | `LEVSPEC.OVL` | Shared stronghold pool `0x454–0x564`, detailed below; per-level activation unverified. |
| 13 | `CHURCH2` | Niveau le plus bas de la forteresse, 09/07 07h15 | `LEVSPEC.OVL` | Same shared stronghold pool; record index/selection unverified. |
| 14 | `CATACOMB` | Catacombes de la forteresse, 09/07 08h00 | `CATACOMB.OVL` | Find/follow Phagan and free Lian (`0x25c–0x2a8`); survival/stealth constraints (`0x2b8–0x2f4`). FOG DLF instead duplicates `LEVSPEC.OVL`. |
| 15 | `WHOUSE` | Entrepôts PHARCOM, 09/08 03h00 | `WHOUSE.OVL` | Shared warehouse pool `0x744–0x89c`, detailed below; per-level activation unverified. |
| 16 | `WHOUSE2` | Gardes d’élite de PHARCOM, 09/08 03h25 | `WHOUSE.OVL` | Same shared warehouse pool; record index/selection unverified. |
| 17 | `INWHOUSE` | Entrepôt 76, 09/08 04h00 | `WHOUSE.OVL` | Same shared warehouse pool; record index/selection unverified. |
| 18 | `CAVE` | Tunnels d’accès au silo, 09/08 04h15 | `CAVE.OVL` | Shared silo pool `0x774–0x8c4`, detailed below. FOG DLF instead duplicates `WHOUSE.OVL`. |
| 19 | `CAVE2` | Tunnel blackout, 09/08 04h45 | `CAVE.OVL` | Same shared silo pool. FOG DLF instead duplicates `WHOUSE.OVL`; the community catalog also gives a different engine overlay from this candidate briefing overlay. |
| 20 | `SILO` | Silo à missiles, 09/08 05h00 | `CAVE.OVL` | Same shared silo pool. FOG DLF instead duplicates `WHOUSE.OVL`; engine/briefing source selection must be verified. |

## Shared text pools, not assigned to individual levels

- `BASEEXT.OVL`: escape (`0x630`), bunker (`0x658`), detectors (`0x678`), Gabrek/keycard (`0x694`), timed escape (`0x6c4`), preserve missiles/explosives (`0x6fc`, `0x71c`), roof (`0x744`), C4 tanks (`0x774–0x7ec`), identify missiles (`0x830–0x888`). There is also an English message in the French disc at `0x8d0`.
- `LEVSPEC.OVL`: find catacombs (`0x454`), preserve subjects (`0x478`), researchers (`0x48c–0x4e0`) and administer antigen (`0x50c–0x564`).
- `WHOUSE.OVL`: reach Warehouse 76 (`0x744`), disable electric gates (`0x764`), question/protect Erikson (`0x790`, `0x7ac`), elevator and 15-minute warning (`0x7ec`, `0x804`), tag virus carriers (`0x840–0x89c`).
- `CAVE.OVL`: locate missile silo (`0x774`), disable power (`0x790`), redirect elevator power (`0x7b4`), missile computer and destruction codes (`0x7dc`, `0x80c`), timing messages (`0x83c`, `0x884`) and preserve missiles (`0x8c4`). This overlay has an additional date-bearing text segment: date counts alone are not a mission count.

## Disc-internal DLF/overlay comparison

The candidate date and title occur inside the FOG's DLF candidate text range for 15 of 20 resources. The remaining five carry another known overlay's exact bytes at DLF offset `0xcc`:

| FOG | Candidate briefing overlay absent from its DLF text | DLF identical run from another overlay at `0x14` |
|---|---|---|
| `SUBWAY3` | `SUBWAY3.OVL` | `SUBWAY.OVL`, 13,608 bytes |
| `CATACOMB` | `CATACOMB.OVL` | `LEVSPEC.OVL`, 4,664 bytes |
| `CAVE` | `CAVE.OVL` | `WHOUSE.OVL`, 8,464 bytes |
| `CAVE2` | `CAVE.OVL` | `WHOUSE.OVL`, 8,464 bytes |
| `SILO` | `CAVE.OVL` | `WHOUSE.OVL`, 8,464 bytes |

The original engine might select a standalone overlay, a DLF copy, or another source. The data alone does not decide. Each FOG and DLF can be hashed and the comparison reproduced with:

```sh
python3 tools/audit_french_mission_containers.py \
  --output work/new-mission-container-report.json
```

The script verifies the disc hash, reads all 20 FOG files and candidate standalone overlays, and refuses to overwrite existing output. Full reproducible metadata is in [the container cross-check](ps1-mission-containers-crosscheck.json).
