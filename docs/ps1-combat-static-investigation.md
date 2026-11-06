# French PS1 combat-table static investigation

## Scope and reproducibility

Target: local French PS-X executable `SCES_019.11`, size 1,824,768 bytes, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. Work is read-only; REA's evidence reports the same digest after every command. REA 6.8.0, Node 24.22.2, Rizin 0.9.1. No French runtime scenario has been executed here.

To reproduce the 26-entry data comparison, run `python3 tools/audit_ps1_weapon_table.py --exe work/rea-investigation/SCES_019.11 --output work/audit-full/new-weapon-table.json` from the repository root. It verifies the executable hash, then reads candidate 0x20-byte entries at file offset `0xfd29c` and emits a new JSON file ([metadata snapshot](ps1-weapon-table-candidates.json)). Its expected labels and proposed interpretation are explicitly transcribed from the community US project's `references/sf-pc-port/src/game/combat.cpp` / `include/sf/game/combat.hpp`; a match is not a runtime observation, nor does a shared index prove that the names or units are identical in French.

The local REA evidence (not included in this repository) was produced by the installed companion. For example, replace `<rea-wrapper>` with the path to its `rea.py` script:

```
python3 <rea-wrapper> execute-rizin-command "$PWD/work/rea-investigation/SCES_019.11" 'pd 28 @ 0x80026938' --format json
```

The PS-X executable has a 0x800-byte header and is loaded at `0x80010000`; file offset `0xfd29c` corresponds to runtime address `0x8010ca9c`. All program addresses below are PS1 addresses, not PC-port addresses. `normalized_result` in each REA JSON records completion, output and before/after artifact hashes.

## Established observations in French code

1. `0x80026958–0x80026978` shifts an index by five bits (32-byte stride), reads a word at `0x8010caa8 + index*32` (table base plus `0x0c`), takes bits 26–30 and passes them as `a1` to `0x80017300`. There is another analogous sequence at `0x80063b10–0x80063b2c`. These are observed instructions, not proof of a particular weapon's action or time unit. Evidence: `ai-fr-table-load-a.json`, `ai-fr-table-load-b.json`.
2. `0x80017300–0x80017318` returns the Boolean result of `(uint32(global_0x80117200 - a0) >= a1)`. It is an unsigned difference/threshold test. Calling the global a frame counter, or assigning firing/cooldown meaning to the callers, remains a hypothesis until its writes and runtime behavior are verified. Evidence: `ai-fr-gate-function.json`.
3. The French code at `0x80015818–0x80015844` reads the global `0x80117200`, increments it by one and stores it back. Another sequence at `0x800933ec–0x80093400` assigns it the word at `0x80122078`. This establishes counter-like updates, not their frequency or relationship with a rendered frame. Evidence: `ai-fr-global-store-a.json`, `ai-fr-global-store-b.json`.
4. At `0x80026b50–0x80026b94`, a signed value is tested against `0x3c1`; the two branches select respectively bits 6–15 of the table word at `base + index*32 + 0x0c`, or the low 10 bits of its halfword at `+0x0e`, and pass the selected number as `a3` to `0x8006a5b0`. A second sequence at `0x80034244–0x800342c4` selects the same fields and calls the same target. Evidence: `ai-fr-damage-field-a.json`, `ai-fr-damage-field-b.json`. This proves the extraction and threshold branch, not that the compared value is a distance or that the callee applies damage. `ai-fr-field-branch-context.json` documents earlier instructions; the compared value is obtained through a structure or a function call, requiring further analysis.
5. Using the community US index/bit-field interpretation as a hypothesis, all 26 consecutive 32-byte French records match the proposed US close/distant/cadence triplets. Record 1 at file `0xfd2bc`, address `0x8010cabc`, has word bytes `8a 0c 19 10` at `0xfd2c8`, candidate values (50, 25, 4). Record 6 at `0xfd35c` has (300, 150, 18), and record 14 at `0xfd45c` has (100, 0, 0). The latter labels and units must not be asserted as French runtime behavior solely from this match.
6. The shared callee at `0x8006a5b0` checks its signed 16-bit first argument against -1 and uses the argument as an index with a 76-byte stride into memory referenced by `0x80116540`. This is consistent with a record lookup, but does not establish that the record is an enemy or that the function inflicts damage. Evidence: `ai-fr-target-function.json`.

## Unresolved before reconstruction

- The call frequency and states of `0x80015818`, meaning of the assignment at `0x80093400`, initial values and wrap behavior in gameplay.
- The meaning, unit and origin of the signed branch input compared with 961.
- Callee `0x8006a5b0`, its arguments, whether/how armor, body part, range and enemy state affect damage.
- Whether both candidate callers are player, NPC or other event paths; no conclusion from names or structural resemblance alone.
- Perception, field of view, sound alerting, target choice, pursuit/cover and NPC lifecycle remain unverified. The US C++ `npc_ai.cpp` is a comparison implementation, not proof for French.
- Frame-accurate behavior must be observed under a verified French runtime, with disc/executable hashes, controlled initial state, recorded inputs, memory reads and independently reproducible test cases.
