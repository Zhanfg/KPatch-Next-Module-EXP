# KPatch Next EXP — r4 compatibility and IME controls

- Shared KPM control dialog: runtime `kpatch kpm ctl0` is immediate;
  boot-image trigger/embedding args are separately staged and only take
  effect after an explicitly chosen boot image patch.
- Staged boot settings are in-memory per KPM name, and are copied onto
  the parsed embedded KPM list when entering the Repair page.
  Never flash automatically from a dialog. Pending options are cleared
  after a successful image patch; they are not persisted between WebUI
  processes.
- Android keyboard: navigation is moved under the soft keyboard when
  the visual viewport shrinks while an editable field is focused.
  The navigation reappears on keyboard dismissal. This does not alter
  keyboard or Android system policy.
- `kpimg`, `kptools`, `kpatch` all built from the same
  `Zhanfg/KPatch-Next-EXP` main SHA; `kpimg` still includes the
  legacy Nohello `is_su_allow_uid` read-only compatibility export.
- EXP latest tagged release checked: `0.13.14`, 2026-09-30.
  EXP main is 12 commits ahead, notably improvements to
  `tools/kallsym.c`, `tools/patch.c`. The older 0.13.14 Android
  `kptools` executable is no longer used in module builds.
- Build provenance is stored in `module/ABI-COMPAT-BUILD.txt`.

**Safety:** CI compilation and UI tests do not validate an Android
device or the effect of boot repatching. Keep an exact working boot
backup and recovery path before any image modification. Module
installation alone does not replace the running kernel core.
