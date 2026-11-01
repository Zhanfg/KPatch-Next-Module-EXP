# Nohello legacy KPM ABI compatibility — test build

## Root cause and scope

Nohello `v1.8.3.7 (102-ab38e9c-release)` references the legacy
`is_su_allow_uid` KPM symbol. Original KPatch-Next exports it, but
KPatch-Next-EXP 0.13.14 removed it. The affected device reported
`load kpm: Nohello, event: pre-kernel-init, rc: -2` and only one
registered KPM.

[Core fix](https://github.com/Zhanfg/KPatch-Next-EXP/pull/1) restores
this legacy symbol as a read-only UID 0 predicate, matching EXP's
current root-only management policy. It does **not** restore the former
per-UID grant list.

## Build provenance

- Module source: this repository.
- Patched `kpimg`: **built from** `Zhanfg/KPatch-Next-EXP` `main`.
- `kpatch` and `kptools`: pinned upstream EXP **0.13.14**.
- `magiskboot`: **v30.6**, as in the original workflow.
- Build output includes `ABI-COMPAT-BUILD.txt` with the exact core SHA.
- CI checks for the exported `__kp_symbol_is_su_allow_uid` symbol.
- Test package version: `v0.0.9-nohello-abi-r1`, code 10.

The user-supplied Nohello KPM is **not** uploaded, repackaged or bundled
in this public repository.

## Important: module install does not update boot

This is a **test build**, not a device-validated fix.

Installing the standalone manager module replaces its resources and
future patching binaries; it does not inject the new `kpimg` into the
already-booted kernel or silently write a boot partition.

After the manager/module has been updated, replacing the old boot-patch
core requires a separately reviewed boot-image patch and flash. Keep
a byte-for-byte backup of the current boot slot and a known recovery
procedure before considering that step. Do not assume the correct
partition, boot slot or successful boot just because the manager
installation succeeds.

Once an explicitly backed-up test boot succeeds, verify the runtime
KPM count/list and actual Nohello behavior. Nohello has previously been
associated with boot failures on other kernels, so **do not auto-load or
force-load the KPM** merely to verify the change.

## Pipeline protection

The ordinary module `Build` workflow must never fetch the upstream
unpatched `kpimg`. It downloads only the pinned Android utilities,
compiles the patched core from the owner's fork, and overwrites
`module/bin/kpimg` with that result before packaging.

The separate integration workflow builds a branch artifact for test
without publishing a release.
