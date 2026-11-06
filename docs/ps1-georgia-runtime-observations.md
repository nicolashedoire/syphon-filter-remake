# French PS1 Georgia Street: first controlled observations

## Scope

On November 6, 2026, the local French SCES-01911 disc (BIN SHA-256 `c0f54d8110eb87b802cb6cadb304251fa5910eafa193a5de16cd2c2651911e72`) was run in RetroArch 1.22.2 with the PCSX ReARMed core r26 `7b0e8f8` and HLE BIOS. Its configuration and memory cards were isolated under the local investigation workspace. HLE behavior is not a substitute for comparison with original hardware or a verified BIOS. No gameplay files in the web project were changed. These observations are a single manual run, not frame-accurate tests.

## Observed sequence

1. The title screen's **Nouvelle partie** selection led to a French Georgia Street agency briefing, then the opening movies. A Start input skipped the first movie; after another Start input during the opening sequence, the in-game map/menu appeared. Exact transition timing was not recorded.
2. On the map's Objectives page at this state, the game displayed two items: eliminate Kravitch and destroy the transmitter; eliminate Rhoemer. This confirms the displayed list at this specific point, not how these objectives change later or their success conditions.
3. Exiting the menu revealed Gabe in Georgia Street by a police vehicle, with armor and `15/30` pistol ammunition. Holding the configured Up key moved him forward toward the vehicle. A subsequent Right key changed the view/orientation; exact turn speed, collision, camera behavior and animation timing were not measured. The user expressly wants the remake's existing follow camera retained.
4. At another visible game state, one press of the configured Square key (RetroArch keyboard `a`) was followed by `14/30` ammunition and Gabe holding his pistol up. Two armed characters appeared nearby, one in a lowered posture and another standing. The observed screenshots do not establish target identity, whether a shot hit, the triggers for the characters' postures, or the rules of their AI.
5. During the run the danger display appeared and the visible armor/health indicators changed. Enemy presence and vehicle fire were both on screen; no controlled damage experiment was made, so a cause or damage rate must not be asserted. The game later returned to the start area, but the precise transition was not recorded well enough to identify its cause.

The emulator is left in its quick menu. Replay with isolated RetroArch and the French disc, choose Nouvelle partie, use the configured Cross button to continue the briefing and Start to skip videos. Default keyboard mappings in the isolated configuration were `z` = Cross, `a` = Square, arrows = D-pad, `Enter` = Start. Test actions can alter the isolated emulator state; no user save cards were used.

## Model-record inventory and comparison with the web prototype

Using the community `MissionObjects` parser (a candidate interpretation, not runtime confirmation), the French `SUBWAY.BIN` (SHA-256 `424a31f2979a04e63f2213307394262b3bc38ec1d3a7fac6136f7e70d9d0d63a`) contains 355 parsed object records. Of these, 30 reference `TERRO.HMD`, 26 of those have a nonempty parsed path, and two reference `CHEMO.HMD`. See [Georgia records](ps1-georgia-actor-records.csv).

The French `SUBWAY2.BIN` (SHA-256 `6ff2eb523e8e3ecb3647fde603571768af4ff79a09fb4d2c0e0cc1135b983e2b`) contains 285 parsed object records: 12 reference `TERRO.HMD`, nine of those have a nonempty parsed path, and one references `CHEMO.HMD`. See [metro records](ps1-metro-actor-records.csv).

Model reference is not proof of an enemy's identity, simultaneous spawn, role, activation or behavior. The path and health-field interpretation derives from the US community parser and needs runtime validation. The Georgia web prototype currently creates two synthetic training targets plus, when available, one authored record (source 184); the metro prototype filters records against its reconstructed collision grid and drops source 210. Thus, data coverage differs substantially, but these record counts do not alone prove how many enemies must appear at any given moment.

Reproduce from already extracted French level BIN files with a C++20 compiler:

```sh
clang++ -std=c++20 -O2 -I references/sf-pc-port/include \
  tools/inventory_ps1_actor_records.cpp references/sf-pc-port/src/assets/mission_objects.cpp \
  -o /tmp/ps1-actor-inventory
/tmp/ps1-actor-inventory /path/to/SUBWAY.BIN > /tmp/georgia-records.csv
/tmp/ps1-actor-inventory /path/to/SUBWAY2.BIN > /tmp/metro-records.csv
```

The tool reads the specified BIN and writes CSV to standard output. It does not validate the BIN's provenance: check the hashes above before comparison.

## Outstanding work

Reproduce the opening from a known state, record timed inputs and multiple views, then test enemy detection, shooting, reactions and objective transitions one at a time. Map confirmed observations back to French MIPS code with REA/Rizin and Ghidra. Measure movements and animation timing before implementing changes. Preserve the user's L2 lock, R2 fire and existing follow camera.
