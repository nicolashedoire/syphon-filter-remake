# Independent Ghidra cross-check

Ghidra 12.1.4 was used alongside REA 6.8.0 and Rizin 0.9.1 on the extracted French executable `SCES_019.11`, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. This is a local static investigation, not a recovered original source tree.

The 0x800-byte PS-X EXE header was removed in a separate copy, and the payload loaded as `MIPS:LE:32:default` at `0x80010000`. Without global analysis, [the small Ghidra script](../tools/ghidra/ExportCandidate.java) defined and decompiled the candidate at `0x80017300`. The decompiler reported:

```c
return param_2 <= (uint)(iRam80117200 - param_1);
```

This is consistent with the previously documented REA/Rizin disassembly's unsigned difference-versus-threshold comparison. The script's function name is invented for the test; names, units, relation to firing and enemy AI remain unconfirmed. Decompiler pseudocode is an interpretation, not original source code. See the [combat static investigation](ps1-combat-static-investigation.md) for the candidate's callers and limits.

A fresh REA/Rizin examination of `0x800492f8` returned complete MIPS disassembly showing null checks, pointer traversal through offset `0x1a4`, and updates involving `0x338(gp)`. It is a candidate linked-structure routine; its relation to player movement or any specific game actor is **not established**. The local evidence records the same executable SHA-256 before and after analysis. Example using the locally installed REA companion:

```sh
python3 <rea-wrapper> execute-rizin-command /path/to/SCES_019.11 \
  'pd 40 @ 0x800492f8' --format json
```

To reproduce the Ghidra cross-check, verify the executable's hash, create a separate copy of its payload excluding its first 0x800 bytes, then import that raw copy into an isolated headless Ghidra project with `-loader BinaryLoader -loader-baseAddr 0x80010000 -processor MIPS:LE:32:default -noanalysis -postScript ExportCandidate.java` and `-scriptPath` pointing to `tools/ghidra`. No copyrighted executable or Ghidra project is included in this repository. Ghidra used a workspace-local Java user home, but also reported cleanup of its standard temporary cache; existing files were not manually touched.
