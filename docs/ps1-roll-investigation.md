# French PS1 roll animation static investigation

## Scope

The investigated PS-X EXE `SCES_019.11` SHA-256 is `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. REA 6.8.0 / Rizin 0.9.1 and Ghidra 12.1.4 were used. All actions are read-only with respect to the executable; the extracted clips and build products are local investigation artifacts. No runtime observation is claimed here. REA evidence JSON retains input digest before and after each command and completion status.

## Five candidate clips

Extracting the embedded HOG with `tools/export_animations.py::find_animation_hog` / `tools/archives_syphon.py`, then parsing with the SF-pc-port HMD/HAN parser (community interpretation) and French `GABE.HMD` (15 parsed parts), produces:

| Clip | Executable file offset | SHA-256 | Pose frames | Parsed root records |
| --- | --- | --- | ---: | ---: |
| `STROL0.HAN` | `0xab788` | `860aeb9c43d8203f88d0e7bcf206d12f32c6c274c801a78c248786fafd9ef324` | 20 | 20 |
| `STROL2.HAN` | `0xabd2c` | `ced77f1c42c3238dc2636259be5a9bfd98f67c73f3d3ee070e6c4039076cf9be` | 25 | 25 |
| `KNROL0.HAN` | `0xa0eb4` | `d1f59f66119cedf84f7b81a5c69799072b838ab78cadd6483765ba4966822c7d` | 22 | 22 |
| `KNROL1.HAN` | `0xa14d8` | `f8c9b52e7d0698cb9b68461752f8ad4aa8b6301b64e3ea2d7fa9d112ed6dce0b` | 20 | 20 |
| `KNROL2.HAN` | `0xa1a88` | `240d2d78c3e5a63613b08213f5fa8f8ebe28c9b07e3ff2f8a5b4e5b27a86ff94` | 23 | 23 |

Gabe model extracted from `SUBWAY.FOG` / `DLF.RFF`: SHA-256 `eab9f49cfbc57be43682306a9a6f2c8b8283487b3d550ad485fc2e97c8f2c8f2`. Every clip has first byte `0xea`; bytes 1–2 give little-endian values 88, 108, 96, 88 and 100, in table order. Under the community parser, they delimit a root-motion prefix and each frame has one four-byte record. Source-specific results with raw signed component values are saved as `*.HAN.txt`; units and in-game playback rates are **not** established. In particular, summing components is not proof of world displacement. `probe.cpp` and the five SHA-verified clips reproduce the counts locally.

All five entries have a subsequent HOG directory entry and their boundaries were verified against its offset. `STROL0.HAN` ends at `0xabd2c` (`STROL2.HAN` begins there), `STROL2.HAN` at `0xac3dc` (`SUREND1.HAN`), `KNROL0.HAN` at `0xa14d8` (`KNROL1.HAN`), `KNROL1.HAN` at `0xa1a88` (`KNROL2.HAN`), and `KNROL2.HAN` at `0xa20e4` (`KNST0.HAN`). These are file offsets exclusive of the next entry and include any stored padding; the last entry is not being inferred from the remainder of the executable. Sizes are respectively 1444, 1712, 1572, 1456 and 1628 bytes.

The community US port maps standing and kneeling/weapon-stance combinations to these names (`src/game/actor_animation.cpp:rollClipName`). This is a hypothesis for the French executable, not proof of when each clip starts or of their exact meaning. The web prototype uses only STROL0 and a 0.65 s roll with 1.2 s cooldown, which have not been established as original timings.

## Native code linkage

Local `decoder_a.json`: French instructions `0x800cbdec–0x800cbe0c` in the routine beginning with a prologue at `0x800cbd80` load a byte at a pointer, compare to `0xea` and, on equality, form a little-endian 16-bit number from bytes 1–2 and add it to that pointer. That precisely agrees with the proposed prefix-offset structure in the clips, but this observation alone does not prove this function receives any particular roll clip or establishes roll direction. REA `roll_header.json` reads the STROL0 prefix at PS1 address `0x800baf88` (file offset `0xab788` under PS-X EXE loading), beginning `ea 58 00 00`. A second French code location `0x800295c4–0x800295e4` (function entry not yet identified) makes an analogous check and pointer adjustment (`decoder_b.json`); its game context is not yet known.

Local `ghidra.log`: independent Ghidra decompilation of a nearby function at `0x800cbd34` confirms code checks a low 16-bit marker `0xefef`, computes a pointer from fields of a preceding word, tests the dereferenced byte as signed `-0x16` (the bit pattern `0xea`), and returns that pointer plus four if accepted. This validates the interpreted instruction pattern, not the function's identity or association with a particular animation. `ExportRollHeader.java` is the exact headless script; payload = executable minus the 0x800-byte header, imported raw little-endian MIPS at 0x80010000, `-noanalysis`. The headless output's assigned function name is analyst-created.

## Reproduction

```sh
python3 /path/to/rea-wrapper.py execute-rizin-command \
  work/rea-investigation/SCES_019.11 'pd 95 @ 0x800cbd28' --format json > /tmp/rea-roll.json
clang++ -std=c++20 -O2 -I references/sf-pc-port/include \
  tools/inventory_ps1_animation.cpp references/sf-pc-port/src/assets/hmd_model.cpp \
  references/sf-pc-port/src/assets/hmd_animation.cpp -o /tmp/ps1-roll-probe
/tmp/ps1-roll-probe work/roll-investigation-new/GABE.HMD work/roll-investigation-new/STROL0.HAN
```

Ghidra invocation: use the same proven binary mapping and headless procedure documented in `docs/ps1-ghidra-cross-check.md`, but replace `-postScript ExportCandidate.java` with `-postScript ExportRollHeader.java` and point `-scriptPath` at `tools/ghidra`.

## Remaining work

Observe forward and lateral rolls from known standing and crouched states, with and without different weapons; record inputs, clip frame rates, displacement, collision, interruption, damage and recovery. Trace runtime animation pointers to these extracted clips before attributing conditions. Preserve the user-requested follow camera and L2/R2 lock/fire overrides.
