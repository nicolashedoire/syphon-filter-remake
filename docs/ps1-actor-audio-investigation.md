# French PS1 candidate decision branch: downstream selector investigation

## Scope

Read-only static investigation of the French PS-X executable `SCES_019.11`, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. REA 6.8.0 / Rizin 0.9.1 and Ghidra 12.1.4 were used. Ghidra imported a header-stripped copy as MIPS little endian at `0x80010000`, with no global analysis. The function names in its output were supplied by the investigator and are not original symbols. Nothing below was dynamically traced; no change to gameplay is justified by this work.

## Starting point

The earlier investigation `docs/ps1-actor-decision-investigation.md` recorded a branch within the routine at `0x8005d988` that calls `0x80057040` with argument 2 equal to 5. The community US port suggests a grenade-related decision for a similar routine; that is a hypothesis about the French code, not confirmed identity. The goal here is to identify what this specific call does, independently of the other branches.

## Observed selector path

- REA at `0x8005dd28–0x8005dd34` confirms the call `0x80057040(actor_candidate, 5)` and a zero store to a caller-owned byte afterward. The zero store is not conditional on any reported return value.
- REA and Ghidra show `0x80057040` obtains a byte at `[arg1+0x1c]+0x52` and selects an 8-byte entry at `0x8010d2f8 + subtype*48 + arg2*8`. It exits when the subtype equals 12, when the selected first word is zero, or when other guards apply. A prior nonzero byte at structure offset `+0x50` also blocks this path when arg2 is at least 2. The code checks `subtype==12`, not a general bound for all possible byte values; the table study below covers 0–11 only.
- In a surviving branch, the function calls `0x800ed174`, divides the returned value by the selected entry's byte `+4`, uses the remainder to select a signed 16-bit value from the selected entry's first-word pointer, and performs further checks including a bitmask and comparison against a previously stored value. It calls `0x8006cf28` with the selected signed value (plus an adjustment for certain subtype conditions), the input structure pointer, and zero. It then records the selected base value and updates status fields. Neither the service's value distribution nor whether the code runs in any observed mission has been measured.
- The locally generated `selector-table.json` captures the on-disc initial bytes of selector column 5 for subtype 0–11. Eight entries have null pointers. Four have non-null pointers and decode to lists: subtype 3 = [212, 214, 215, 216, 217], subtype 7 = [239, 240, 241], subtype 9 = [301, 311, 313, 315], subtype 10 = [485, 490, 482, 483, 484]. The initial bytes do not prove a live subtype or that runtime memory remains unchanged; the code allows for values outside 0–11 except exactly 12.

## Downstream audio-related evidence

- REA/Ghidra show `0x8006cf28` conditionally passes the selected signed short to `0x800c0ad8` along with additional values, then records status and arranges a callback. This does not prove every path plays a sound or what an ID refers to.
- In one guarded path, `0x800c0ad8` invokes `0x800f7c04` with a first argument of zero. `0x800f7c04` constructs a structure whose flags include `0xc0`, then calls `0x800f65a4`. The latter checks bits `0x40` and `0x80` and writes halfwords to offsets `0x1b0` and `0x1b2` through the pointer at `0x80115990` (`0x800f6738–0x800f677c`). REA reads that pointer's initial executable bytes as `00 1c 80 1f`, i.e. `0x1f801c00`.
- The existing independently developed community emulator documents the SPU register base `0x1f801c00` in `references/sf-pc-port/include/sf/psx/spu.hpp` and treats offsets `0x1b0` and `0x1b2` as CD input volume left and right in `references/sf-pc-port/src/psx/spu.cpp`. This is consistent with an audio/CD-stream branch. The indicated register path is conditional and does not establish the identity or language of any sound. Static reachability is not evidence that the branch occurred in the recorded French gameplay.
- Thus it would be premature to claim that this call directly creates or throws a grenade. It appears to choose an ID and can lead into audio-related controls. The caller and its other operations may nevertheless participate in combat or grenade logic; no inference about the entire routine is established.

## Reproduction

Evidence retained in the local investigation workspace (not committed to this repository): REA JSON files `caller-rea.json`, `callee-rea.json`, `downstream-rea.json`, `index-playback-rea.json`, `library-rea.json`, `spu-controls-rea.json`, and `spu-base-rea.json` each completed with exit code 0 and the same executable SHA-256 before and after. `ghidra-callee.log` and `ghidra-downstream.log` report completed decompilation. The two manually assigned Ghidra functions can be reproduced with `tools/ghidra/ExportActorAudioSelector.java` and `tools/ghidra/ExportActorAudioConsumer.java` on the mapped payload. The selector table was generated twice, byte-identically, using:

```sh
python3 tools/audit_ps1_actor_audio_selector.py /path/to/SCES_019.11 --output /path/to/new-selector-table.json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  /path/to/SCES_019.11 'pd 180 @ 0x80057040' --format json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  /path/to/SCES_019.11 'pd 300 @ 0x800f65a4' --format json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  /path/to/SCES_019.11 'px 4 @ 0x80115990' --format json
```

Next, capture a controlled gameplay event and trace the live parameter, selected ID, CD/SPU writes and any associated visible projectile independently. Check a different emulator or hardware before asserting original timing or audio behavior.
