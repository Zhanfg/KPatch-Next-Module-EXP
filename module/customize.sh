MODDIR="/data/adb/modules/KPatch-Next"

# Conflict with APatch
if [ "$APATCH" ]; then
    abort "! APatch is unsupported"
fi

# We only support arm64
if [ "$ARCH" != "arm64" ]; then
    abort "! Only arm64 is supported"
fi

set_perm_recursive "$MODPATH/bin" 0 2000 0755 0755

mkdir -p /data/adb/kp-next

# try get package_config from APatch
if [ -f "/data/adb/ap/package_config" ] && [ ! -f "/data/adb/kp-next/package_config" ]; then
    cp "/data/adb/ap/package_config" /data/adb/kp-next/package_config
fi

# Installation preflight: validate the *staged* payload before KSU/SukiSU
# commits it during reboot. Never hot-copy new WebUI / executables into
# the currently active (old) module: that produces mismatched versions and
# can make the UI appear updated while module.prop and tools remain old.
for required in module.prop webroot/index.html bin/kpatch bin/kptools bin/kpimg; do
    [ -s "$MODPATH/$required" ] || abort "! Missing staged file: $required"
done
grep -qx 'id=KPatch-Next' "$MODPATH/module.prop" ||
    abort "! This is not a KPatch-Next module package"
ui_print "- Staged KPatch Next EXP: $(sed -n 's/^version=//p' "$MODPATH/module.prop" | head -n 1)"
ui_print "- Update will activate after reboot; the active WebUI is left intact."
