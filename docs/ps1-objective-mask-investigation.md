# French PS1 objective masks and linked actor records

## Scope

Research only. No gameplay files were changed. Original French `SCES_019.11` SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`; French disc BIN SHA-256 `c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72`. REA 6.8.0/Rizin 0.9.1 and Ghidra 12.1.4 were used on copies or read-only inputs. All 14 REA outputs completed, returned exit 0, and preserved the target digest. The four headless Ghidra scripts reported `Completed: true`. All inferred function names, parameter types, object-class descriptions and code paths are analyst interpretations, not original symbols or observed runtime execution.

Previous work linked Georgia's candidate descriptor (`SUBWAY.OVL` file offset `0x3264`, candidate PS1 address `0x80149f74`) to two counted arrays (five and two text pointers) and main-executable routine `0x800928d8`. The overlay base `0x80146d10` remains a well-supported **static hypothesis**, not an observed load address.

## New candidate mask behavior

- At `0x800e4530–0x800e4534` the French startup code sets `gp = 0x801164e0` (local REA `gp-bootstrap.json`). If that value persists at the relevant functions, `gp + 0xc34` resolves to `0x80117114`, the descriptor pointer already identified with absolute addressing. Its runtime value has not been recorded.
- `0x80018190` loads `[gp+0xc34]`. If the pointer is non-null and another guard is met, it computes `1 << (arg0 & 31)`. When the low byte of argument 2 is zero it tests bit at descriptor `+0x20` and returns early if already set; otherwise it ORs that bit into `+0x20`. When argument 2 is nonzero it instead tests and sets the bit at `+0x14`. Local REA `state-update.json` and Ghidra `ghidra-mask.log` agree. This is evidence of two distinct bitfields and duplicate suppression; their gameplay meanings remain unknown.
- `0x80018704` loads the same GP-relative pointer and, if non-null and bit `1 << (arg0 & 31)` is not yet set in `+0x18`, sets that bit in **both** `+0x18` and `+0x1c` (`state-related.json`, `ghidra-dual-mask.log`). Additional branches depend on other variables. Neither this nor the preceding function proves whether a bit means active, completed, failed, displayed or something else.
- Georgia overlay code at file offsets `0x29f0–0x29fc` calls `0x800928d8` with descriptor candidate `0x80149f74`. Immediately after, offsets `0x2a00–0x2aac` test descriptor field `+0x18`; if zero, then after two calls they load count `+8` and, for indices `0..count-1`, set the corresponding bits in `+0x24` while the pointer is non-null. They then clear bit `0x10` in `+0x1c`. The static descriptor contains count `2` at `+8`, but the observed code is conditional and no runtime memory trace confirms the count/pointer at execution. REA `overlay-georgia.json` and Ghidra `ghidra-georgia.log` cross-check the flow (manual function entry overlay offset `0x2904`, mapped candidate address `0x80149614`).

## Object-linked path in three overlays

- The FR executable routine at `0x80067408` checks a bit in descriptor `+0x20`, processes a 76-byte object record when argument 3 is an index, and has guarded paths checking the linked definition's first signed halfword against `0x2e`. Depending on arguments and guards it can test/set a bit in descriptor `+0x14`, call `0x800672f4`, and call `0x80018190` with index and mode. See the locally retained `main-object-674.json` and `ghidra-main.log`. Numeric fields, event trigger, character/target identity and result remain unproved without execution tracing.
- In the 13 candidate overlays an aligned raw-word scan found a candidate direct call to `0x80067408` in `SUBWAY.OVL:0x1ce4`, `SUBWAY2.OVL:0x55c` and `PARK.OVL:0x97c`. REA disassembled all three. Treat the scan as coverage of **aligned direct JAL encodings**, not all calls or proof these paths run. In `SUBWAY2` the preceding path compares a definition-like value to `0x35`, computes a 76-byte record address and passes the signed halfword at record `+0x30` as argument 3. In Georgia a similar index is loaded and passed after another helper; the value of the fifth argument depends on that helper. The park path includes a check against `0x2e` before its call. All code offsets are file offsets; absolute overlay addresses assume base `0x80146d10`.
- Independently, the verified French `SUBWAY.BIN` and `SUBWAY2.BIN` were read with the community layout: definition stride 20, record stride 76, class/primary-model fields and link at object offset `+0x30`. Georgia record 173 has class `0x35`, primary model `CHEMO.HMD`, link 29; target 29 has class `0x2e`, primary model `BOMB.TMD`. Metro record 209 has class `0x35`, primary model `CHEMO.HMD`, link 0; target 0 has class `0x2e`, primary model `BOMB.TMD`. Georgia's other class-`0x35` record 172 has link -1. See the locally retained `actor-links.json` and `tools/audit_ps1_actor_links.py`. This is a concrete cross-check between data values and code tests, **not** proof a particular CBDC agent, bomb, event or objective transition was observed at runtime.

## Reproduction

From the repository root, supply locally obtained, verified French inputs. Output files must not already exist. The class/link audit reads extracted level BINs, while the call scan reads the French disc and extracted executable.

```sh
python3 tools/audit_ps1_actor_links.py \
  --georgia /path/to/SUBWAY.BIN --metro /path/to/SUBWAY2.BIN \
  --output work/new-actor-links.json
python3 tools/audit_ps1_objective_calls.py \
  --exe /path/to/SCES_019.11 --cue /path/to/french-disc.cue \
  --output work/new-objective-calls.json
python3 /path/to/rea-wrapper.py execute-rizin-command /path/to/SCES_019.11 \
  'pd 180 @ 0x80018190' --format json
python3 /path/to/rea-wrapper.py execute-rizin-command /path/to/SCES_019.11 \
  'pd 170 @ 0x80067408' --format json
```

The scripts validate input hashes and refuse to overwrite reports. The link and call JSON reproduced byte-for-byte on a second run. Original level BINs can be extracted with `tools/inspecter_disque_ps1.py` and `tools/archives_syphon.py`; see their `--help`. Neither input binary nor research outputs are included in the repository.

The checked-in Ghidra scripts under `tools/ghidra/` are `InspectObjectiveMaskWrite.java`, `InspectObjectiveDualMask.java`, `InspectObjectiveActorLink.java` and `InspectGeorgiaInitialMasks.java`. For the first three import a verified header-stripped PS-X payload as raw `MIPS:LE:32:default` at `0x80010000`; for the last import the French `SUBWAY.OVL` at the candidate base `0x80146d10`. Use a disposable headless project, `-noanalysis`, and `-scriptPath` pointing at `tools/ghidra`, as in [the Ghidra cross-check](ps1-ghidra-cross-check.md). Local logs contain the pseudocode; generated projects and game data are not included.

## Unresolved

Trace the running FR game with controlled player/NPC actions: record the descriptor pointer, fields before/after a specific event, linked actor/target indices and call arguments. Establish the use of each mask, objective activation/visibility/success/failure and overlay selection before attributing game rules or implementing changes.
