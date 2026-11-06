# French PS1 runtime investigation

The goal is to observe the identified French disc in a reproducible emulator environment and correlate behavior with REA/Rizin disassembly. No gameplay conclusion follows solely from the tests below.

## CPU bootstrap probe

A local R3000 interpreter from the community port was run twice on the extracted French `SCES_019.11` executable (SHA-256 `059c6cbfabe686555b4bb45c61c3116b42eadbf1ac9c94b10ae4416891c38a95`). Both traces were identical and reached BIOS vector `0xa0` with selector `0x39` after 199,504 instructions, starting at `0x800e44b4`. The probe uses a synthetic initial state and stops before that BIOS call; it does not simulate the complete console, boot or gameplay.

## PCSX-Redux

Official macOS ARM build 432 could not launch on the test system, macOS 15.1.1, because its `libhvf.dylib` dependency was unavailable. Official build 73 launched and ran without a disc, but reproducibly exited with a segmentation fault after approximately 15 seconds when the French CUE was loaded and running. Simplifying the disc path and changing card settings did not solve it. The failure's cause was not established. The tests did not use a Sony BIOS or existing save cards, and did not establish whether a menu or game frame was reached.

An initial `-help` invocation unexpectedly launched the GUI and created a PCSX-Redux user configuration file; subsequent emulator tests used workspace-local configuration and card paths. Local test logs contain the exact command lines and checksums. The configuration file and operating-system diagnostics were left untouched.

The next required step is to establish a working instrumented French runtime, record emulator/core version and disc hash, then capture repeatable inputs, screen observations and traces for movement, AI, objectives, video and save transitions. An emulator recognizing the disc is not by itself evidence that a level was observed or its rules verified.

## RetroArch / PCSX ReARMed

A subsequent isolated RetroArch 1.22.2 test using the ARM64 PCSX ReARMed core and its HLE BIOS identified the French executable, displayed an original cinematic and the French main menu, and entered an automatic demo. This establishes that the disc can render in that configuration; it does not establish a controllable mission or verify specific gameplay rules. A second automated screenshot attempt captured a pause screen instead, so screenshot timing and window focus still need a reproducible procedure. No Sony BIOS was used and existing user save cards were not loaded or saved. Test configuration, logs and captures remain local to the investigation workspace.
