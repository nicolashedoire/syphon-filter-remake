# French mission objective descriptors: static code and data link

## Scope

Read-only research on the local French SCES-01911 disc and executable. French executable SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`; full BIN SHA-256 `c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72`. `SUBWAY.OVL` SHA-256 `a1edd4a03015d46860c7d37cc8da85003e4331739401b24c17e133446eb716d4`; `SUBWAY3.OVL` SHA-256 `1ab95bfe27a49cc6960270f4d94dc5e7d09d4c40735f9d8316108977ea217746`. REA 6.8.0, Rizin 0.9.1, Ghidra 12.1.4; the target files remained unchanged. These are static results, not observed runtime traces. The 20 resource-to-overlay associations remain hypotheses from the community US catalog. No browser-game changes.

## Thirteen overlays share a candidate address mapping

For each of the 13 standalone French overlays corresponding to the 20-resource catalog, the aligned 32-bit values in the file contain multiple distinct pointers that resolve to the exact starts of stored strings if byte offset zero is assigned base `0x80146d10`. This mapping has 6–45 distinct string-start matches per overlay (`pointer-scan.json`), and additionally makes internal pointers to arrays resolve in range to coherent counted arrays. This is strong static consistency, not a runtime measurement of where the loader placed data.

A bounded structural scan found candidate counted pointer arrays in all 13 overlays (`array-scan.json`). Multiple overlapping candidates may be reported; some are substructures or false positives. All match the input hash and were reproduced byte-for-byte. These data structures, labels and counts cannot establish when the game displays a text, its activation/completion conditions, the order of mission progression, or which resource selects it.

## Two concrete descriptor examples, independently followed in Ghidra

- For French `SUBWAY.OVL`, the byte range at file offset `0x3264` has two count/pointer pairs. Under the candidate base this descriptor is `0x80149f74`: group A count 5 points at `0x80149f2c`, group B count 2 points at `0x80149f40`. Ghidra follows the pointers and obtains four Georgia objective-related texts plus a literal `.` placeholder in A, and two CBDC/explosives constraint texts in B. `ghidra-georgia-descriptor.log` and `rea-georgia-arrays.json` preserve the observations.
- For French `SUBWAY3.OVL`, descriptor file offset `0x2470`, candidate address `0x80149180`, has groups of one and one. Ghidra follows them to the Aramov elimination text and the rail/grenade restriction, respectively (`ghidra-subway3-descriptor.log`, `rea-subway3-arrays.json`). This candidate standalone overlay is distinct from the `SUBWAY.OVL` bytes embedded in `SUBWAY3.FOG`'s DLF. The engine's actual source selection and call execution remain unverified.

## Instruction linkage

- Raw aligned `JAL` words encoding low 28-bit target `0x000928d8` occur 19 times across all 13 overlays (`call-count.json`). With the candidate overlay address and high PC bits `0x8`, these target `0x800928d8`. A raw-word match is not by itself proof that each occurrence executes as code or with a particular argument.
- In `SUBWAY.OVL`, REA/Rizin disassembly at file offsets `0x29f0–0x29fc` shows `lui a0,0x8015; addiu a0,a0,-0x608c; jal ...; move a1,zero`, which supplies `0x80149f74` before the candidate call. In `SUBWAY3.OVL` offsets `0x2210–0x221c`, the analogous immediate supplies `0x80149180`. For other overlays, nearby assignments in `callsite-scan.json` use a deliberately simplistic heuristic; they are not a complete control-flow/data-flow proof.
- In the French main executable at `0x800928d8`, REA and Ghidra agree that the routine stores its first argument in global `0x80117114`. If non-null, it copies six global words at `0x80122058–0x8012206c` into descriptor offsets `+0x10` through `+0x24`. See `rea-main-descriptor-callee.json` and `ghidra-objective-consumer.log`. Their meaning is unknown.
- At `0x80092fb0–0x80093000`, REA observes the reverse transfer from descriptor fields `+0x10..+0x24` back to those six globals. At `0x80067458–0x80067464` and `0x80067528–0x80067534`, code tests or sets bits in fields `+0x20` and `+0x14`. The specific bits' gameplay meanings and calling conditions are unknown.
- In `SUBWAY3.OVL` offsets `0x222c–0x224c`, the code loads global `0x80117114` and ORs bit 0 into descriptor field `+0x24` when the pointer is non-null (`rea-subway3-descriptor-caller.json`). It is an observed code path, not evidence that this means an objective is complete, active or failed.

## Reproduction and checks

From the repository root with the French disc, run:

```sh
python3 tools/audit_ps1_objective_descriptors.py --output work/new-objective-descriptors.json
```

This read-only scan verifies the disc hash, produces a new output and refuses to overwrite existing files. It reproduces the pointer-base candidates, counted-array summaries and raw JAL-word offsets in [the metadata index](ps1-objective-descriptor-index.json). The local heuristic `callsite_scan.py` is not included; its results require manual disassembly.

For REA use `rea.py execute-rizin-command /path/to/SCES_019.11 'pd 100 @ 0x800928d8' --format json`; for an overlay use `... /path/to/SUBWAY.OVL 'e asm.arch=mips; e asm.bits=32; e cfg.bigendian=false; pd 50 @ 0x2990' --format json`. Seven local REA results completed with exit 0 and retained identical target hashes before and after.

For Ghidra use a temporary headless project, raw import `SUBWAY.OVL` at `0x80146d10` as `MIPS:LE:32:default`, and `-noanalysis -postScript InspectObjectiveDescriptor.java 0x80149f74` with `-scriptPath` pointing to `tools/ghidra`. Repeat using `SUBWAY3.OVL` and `0x80149180`. For the main executable, import a copy with the 0x800-byte PS-X EXE header removed at `0x80010000`; run `ExportObjectiveConsumer.java`. Ghidra's inferred symbol names and types are analyst-created, not original game source symbols.

## Next verification

Trace the runtime contents and use of `0x80117114` in a controlled French mission, identify descriptor field bit meanings by replayed actions, and establish whether the engine loads standalone or embedded overlays for the five mismatched resources. Do not interpret text arrays as a verified mission sequence or replace gameplay based on static data alone.
