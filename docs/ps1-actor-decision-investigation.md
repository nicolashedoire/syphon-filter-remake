# French PS1 candidate actor decision routine

## Scope and method

Read-only investigation of French `SCES_019.11`, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`, REA 6.8.0 / Rizin 0.9.1 and Ghidra 12.1.4. The initial hypothesis came from the US community port's `src/game/legacy_gameplay_vm.cpp` near line 7797, which associates US `0x8005d088`, an `ai+0x4a` counter and threshold `0x3d` with a grenade decision. That US description is not evidence that the French routine is identical or that it is reached during the tested mission.

A raw 32-bit little-endian scan of the verified executable payload found exactly one `lb`/`lbu` using immediate offset `0x4a` with an instruction encoding one of `0x3c`, `0x3d`, `0x3e` within 48 instructions: `lbu` at `0x8005dc00`, comparison at `0x8005dc08`. The scan also treats embedded data as possible instructions, so this is a candidate discovery method, not a function inventory or proof of code identity. `find_candidates.py` reproduces the scan, checks the input digest and refuses to overwrite output. REA instructions and Ghidra decompilation independently corroborate the following code observations.

## Observations

- `0x8005d988` has a MIPS stack prologue. The analyst-created Ghidra function beginning there contains the candidate and was decompiled successfully. Code at `0x8005d9a4` reads an index at argument `+2`; `0x8005d9b4–0x8005d9cc` uses 76-byte records via global `0x80116540`, consistent with the object-table structure investigated earlier. This is structural similarity, not proof of which actor or role reaches it.
- With several early-exit conditions satisfied, `0x8005da64–0x8005da78` increments the byte at `[arg+0x1c]+0x4a` and returns when its stored unsigned result is below `0x15` (21). In one later guarded path, `0x8005dc00–0x8005dc0c` exits if the same byte is below `0x3d` (61). A byte can wrap; these numbers are counts under unknown invocation conditions, not seconds or frames.
- Further gates check flag bits and a second byte (`0x8005dc14–0x8005dc4c`), then call `0x800ed174` and mask the result with `7` (`0x8005dc54–0x8005dc5c`). `0x800ed174` sets register `t1=0x2f` and jumps to BIOS vector `0xa0`; the US community port implements A0:2f as `rand`. The semantics, state and distribution of the user's HLE BIOS implementation were not checked here, so a pseudo-random decision is a plausible interpretation, not a measured distribution.
- The low-three-bit value determines code branches at `<4` and `<6`, among other gates. A path calls `0x80057040` with second argument `5` and writes zero to the byte at `+0x4a`; another path likewise writes zero after testing object/flag conditions and a field of the candidate weapon table. Exact called behavior and gameplay outcome remain unknown.
- A raw scan for direct `jal` encodings to `0x8005d988` found one candidate address, `0x8005f3b0`; REA disassembly confirms this direct call after tests of a byte at `+0x48`, flag `0x400`, and a word at `+0x3c`. The raw scan cannot find indirect calls and may also scan data. It does not show whether the caller runs for enemies, which actors invoke it or its timing.

## Evidence and reproduction

The local evidence files are `decision-prologue-rea.json`, `grenade-candidate-rea.json`, `caller-rea.json`, `value-source-rea.json` and `ghidra-decision.log`; REA command results report completion and the same input SHA-256 afterward. The manually assigned Ghidra function name is not an original debug symbol.

```sh
python3 tools/audit_ps1_decision_candidates.py work/rea-investigation/SCES_019.11 --output work/new-decision-scan.json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  work/rea-investigation/SCES_019.11 'pd 160 @ 0x8005d988' --format json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  work/rea-investigation/SCES_019.11 'pd 200 @ 0x8005db40' --format json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  work/rea-investigation/SCES_019.11 'pd 110 @ 0x8005f300' --format json
python3 /path/to/pilot-rea-investigation/scripts/rea.py execute-rizin-command \
  work/rea-investigation/SCES_019.11 'pd 40 @ 0x800ed174' --format json
```

For Ghidra, import the header-stripped payload as raw `MIPS:LE:32:default` at `0x80010000`, disable global analysis and run `ExportNpcDecision.java` from `tools/ghidra`. This uses the same mapping recorded in `docs/ps1-ghidra-cross-check.md`.

## Next verification

Record controlled French gameplay and trace an actual actor's structure and call path before mapping this candidate to detection, combat, grenade choice, animation or timing. No timing or change to the remake is justified yet.
