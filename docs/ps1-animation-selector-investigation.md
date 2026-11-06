# French PS1 animation selector: REA and Ghidra follow-up

## Scope and limitations

Static inspection of French `SCES_019.11`, size 1,824,768 bytes, SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`. The executable was not modified. REA 6.8.0 / Rizin 0.9.1 and Ghidra 12.1.4 were used independently; Ghidra imported the header-stripped payload as raw little-endian MIPS at `0x80010000`, with `-noanalysis` and analyst-supplied candidate function names. Results are code paths, not original source code or gameplay traces. No roll-specific entry, initiation conditions, playback timing, collision or direction is established.

## Confirmed static observations

1. `0x80028af0` accesses a pointer at input structure offset `+0x18`. If it is zero the function returns `0x8010bd8c`. Otherwise it traverses 24-byte records and returns the first record for which the first signed 16-bit field is nonpositive, or matches argument 2 with its second signed 16-bit field either zero or matching argument 3. Both REA's `selector-table.json` and Ghidra's `ghidra-lookup.log` show this control flow. No interpretation as an input button or animation state is proven.
2. The French routine beginning at `0x80029874` calls `0x80028af0` at `0x800298f8`; its result is held in register `s3`. One branch at `0x80029a54` loads the byte at `s3 + 8` into `s4`; another at `0x80029a98` loads `s3 + 7`. At `0x80029c08–0x80029c28`, the signed 16-bit form of `s4` is passed as the second argument to `0x800cbd80`. These fields' semantic names and exact gameplay conditions remain unresolved. See `index-argument-source.json` and `decoder-caller-a.json`.
3. At `0x800cbd80`, `param_1 + 0x10` supplies an object. Depending on bit `0x02000000` in its field `+0x28`, the routine selects either the pointer at `+0x2c` or the pointer indexed by argument 2 from the array at `+0x2c`. The selected buffer is checked for byte `0xea` and, when matched, advanced by the unsigned little-endian 16-bit value stored in bytes 1 and 2. The resulting pointer is compared with current linked entries; if a new record is created, this pointer and the 16-bit index are stored and `0x800cd800` is called with the same index. REA `decoder-entry.json` and Ghidra `ghidra-path.log` agree on these observable instructions. The marker agrees with the five independently extracted roll candidates in `docs/ps1-roll-investigation.md`, but the shared header does not prove that any roll executes this path.
4. A different direct call at `0x800cbc88`, within the routine starting `0x800cbc34`, forwards its incoming argument 2 to `0x800cbd80`; it supplies zero in argument 4 and `0x1e` as a stack argument. At `0x80029c28`, the stack argument is `0x14`. Their meaning, units and any connection to frame rate are unknown. See `decoder-caller-b.json` and `decoder-caller-a.json`.
5. A direct instruction scan found calls to `0x800cbd80` at `0x80029c28`, `0x800cbc88`, `0x800cbf24`, `0x800cbf4c`. The REA disassembly verifies the first two are calls; the latter two are short wrapper routines. At `0x8002940c`, another routine calls the wrapper at `0x800cbc34`, after computing a 76-byte object-record index from its first argument and loading a nested pointer. `decoder-caller-c.json` records this; no actor identity is established.

At `0x8002a244–0x8002a2b0`, the caller of `0x80029874` repeatedly queries the same lookup and compares its returned bytes `+6`, `+7` and `+8` against three 32-bit values in another structure. It then conditionally calls `0x80029874` at `0x8002a2f0` after a separate test. These observed comparisons further connect the record fields to the same selection path, without revealing input semantics or verifying a roll. See `selector-parent.json`.

The parsed embedded animation HOG directory orders the five candidates as zero-based indices 71 (`KNROL0.HAN`), 72 (`KNROL1.HAN`), 73 (`KNROL2.HAN`), 127 (`STROL0.HAN`), 128 (`STROL2.HAN`). Their ordinal position is an objective property of this HOG directory, **not** proof that the above routine's argument uses that directory's numbering or that any of those values is selected during a roll. Binding the two requires a French runtime pointer and controlled input trace.

## Reproduce

```sh
python3 /path/to/rea-wrapper.py execute-rizin-command /path/to/SCES_019.11 \
  'pd 80 @ 0x80028af0' --format json > /tmp/selector-table.json
python3 /path/to/rea-wrapper.py execute-rizin-command /path/to/SCES_019.11 \
  'pd 120 @ 0x800cbd80' --format json > /tmp/decoder-entry.json
```

Ghidra scripts `ExportRollLookup.java` and `ExportRollPath.java` can be used with the headless mapping documented in `docs/ps1-ghidra-cross-check.md`; their exported names are descriptive placeholders. The complete evidence and digest-preservation checks remain in the local investigation workspace; the scripts are under `tools/ghidra`. The HOG indices are reproduced by `tools/export_animations.py::find_animation_hog` with the executable digest above.
