import '@material/web/all.js';
import { installImeViewportGuard } from './viewport.js';
import { exec, toast } from 'kernelsu-alt';
import { setupRoute } from './route.js';
import { getString, loadTranslations } from './language.js';
import * as patchModule from './page/patch.js';
import * as kpmModule from './page/kpm.js';
import * as excludeModule from './page/exclude.js';

export const modDir = '/data/adb/modules/KPatch-Next';
export const persistDir = '/data/adb/kp-next';

export let MAX_CHUNK_SIZE = 96 * 1024;

async function updateStatus() {
    const version = await patchModule.getInstalledVersion();
    const versionText = document.getElementById('version');
    const notInstalled = document.getElementById('not-installed');
    const working = document.getElementById('working');
    const installedOnly = document.querySelectorAll('.installed-only');
    if (version) {
        versionText.textContent = version;
        kpmModule.refreshKpmList();
        initRehook();
        installedOnly.forEach(el => el.removeAttribute('hidden'));
    } else {
        installedOnly.forEach(el => el.setAttribute('hidden', ''));
    }
    notInstalled.classList.toggle('hidden', version);
    working.classList.toggle('hidden', !version);
}

export function escapeShell(cmd) {
    if (cmd === '' || cmd === null || cmd === undefined) return '""';
    return '"' + cmd.replace(/[\\"$`]/g, '\\$&') + '"';
}

export async function initInfo() {
    const result = await exec('uname -r && getprop ro.build.version.release && getprop ro.build.fingerprint && getenforce');
    if (import.meta.env.DEV) { // vite debug
        result.stdout = '6.18.2-linux\n16\nLinuxPC\nEnforcing';
    }
    const info = result.stdout.trim().split('\n');
    document.getElementById('kernel-release').textContent = info[0];
    document.getElementById('system').textContent = info[1];
    document.getElementById('fingerprint').textContent = info[2];
    document.getElementById('selinux').textContent = info[3];
}

async function reboot(reason = "") {
    if (reason === "recovery") {
        // KEYCODE_POWER = 26, hide incorrect "Factory data reset" message
        await exec("/system/bin/input keyevent 26");
    }
    exec(`/system/bin/svc power reboot ${reason} || /system/bin/reboot ${reason}`);
}

async function initRehook() {
    const rehook = document.getElementById('rehook');
    const rehookRipple = rehook.querySelector('md-ripple');
    const rehookSwitch = rehook.querySelector('md-switch');
    const isEnabled = await updateRehookStatus();
    if (isEnabled === null) {
        rehookRipple.disabled = true;
        rehookSwitch.disabled = true;
        return;
    }
    rehookSwitch.addEventListener('change', () => {
        setRehookMode(rehookSwitch.selected);
    });
}

async function updateRehookStatus() {
    const rehook = document.getElementById('rehook');
    const rehookSwitch = rehook.querySelector('md-switch');

    let isEnabled = null;

    const result = await exec(`kpatch rehook_status`, { env: { PATH: `${modDir}/bin` } });
    if (result.errno === 0) {
        const mode = result.stdout.split(':')[1].trim();
        if (mode === 'enabled') {
            isEnabled = true;
        } else if (mode === 'disabled') {
            isEnabled = false;
        }
        rehookSwitch.selected = isEnabled;
    }

    return isEnabled;
}

function setRehookMode(isEnable) {
    const mode = isEnable ? "enable" : "disable";
    exec(`
        kpatch rehook ${mode} && echo ${mode} > ${persistDir}/rehook && sh "${modDir}/status.sh"`,
        { env: { PATH: `${modDir}/bin:$PATH` } }
    ).then((result) => {
        if (result.errno !== 0) {
            toast(getString('msg_error', result.stderr));
            return;
        }
        updateRehookStatus();
    })
}

function getMaxChunkSize() {
    exec('getconf ARG_MAX').then((result) => {
        try {
            const max_arg = parseInt(result.stdout.trim());
            if (!isNaN(max_arg)) {
                // max_arg * 0.75 (base64 size increase) - command length
                MAX_CHUNK_SIZE = Math.floor(max_arg * 0.75) - 1024;
            }
        } catch (e) { }
    });
}

export function linkRedirect(link) {
    toast(getString('msg_redirecting_to', link));
    setTimeout(() => {
        exec(`am start -a android.intent.action.VIEW -d ${link}`)
            .then(({ errno }) => {
                if (errno !== 0) {
                    toast(getString('msg_failed_open_link'));
                    window.open(link, "_blank");
                }
            });
    }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splash');
    try {
        document.querySelectorAll('[unresolved]').forEach(el => el.removeAttribute('unresolved'));
        if (splash) setTimeout(() => splash.querySelector('.splash-icon')?.classList.add('show'), 20);

        // First render and wire all controls before making any device requests.
        // A stuck Android shell or failed locale fetch must never trap the splash.
        installImeViewportGuard();
        setupRoute();
        // The page shell is now interactive. Later feature initialization
        // failures must not be reclassified as application boot failures.
        window.__kpStartup?.ready();
    } catch (error) {
        console.error('WebUI shell startup failed', error);
        window.__kpStartup?.fail('shell-startup', error);
        return;
    }

    // Control wiring is independent from route rendering.
    try {
        const language = document.getElementById('language');
        const languageDialog = document.getElementById('language-dialog');
        language.onclick = () => languageDialog.show();
        languageDialog.querySelector('.cancel').onclick = () => languageDialog.close();

        document.getElementById('embed').onclick = patchModule.embedKPM;
        document.getElementById('start').onclick = () => {
            document.querySelector('.trailing-btn').style.display = 'none';
            patchModule.patch("patch");
        };
        document.getElementById('unpatch').onclick = () => {
            document.querySelector('.trailing-btn').style.display = 'none';
            patchModule.patch("unpatch");
        };

        const rebootMenu = document.getElementById('reboot-menu');
        document.getElementById('reboot-btn').onclick = () => {
            rebootMenu.open = !rebootMenu.open;
        };
        rebootMenu.querySelectorAll('md-menu-item').forEach(item => {
            item.onclick = () => reboot(item.getAttribute('data-reason'));
        });
        document.getElementById('reboot-fab').onclick = () => reboot();

    } catch (error) {
        window.__kpStartup?.issue('controls-wiring', error);
        // Continue loading translations and other independent pages.
    }

    // Independent pages must work even when locale loading hangs in a WebView.
    // Do not let one page's failure disable the other one.
    try {
        excludeModule.initExcludePage();
    } catch (error) {
        window.__kpStartup?.issue('exclude-page', error);
    }
    try {
        kpmModule.initKPMPage();
    } catch (error) {
        window.__kpStartup?.issue('kpm-page', error);
    }
    Promise.resolve().then(() => loadTranslations()).catch(error => {
        window.__kpStartup?.issue('translation', error);
    });
    Promise.resolve().then(() => getMaxChunkSize()).catch(error => {
        window.__kpStartup?.issue('argmax-probe', error);
    });
    Promise.resolve().then(() => updateStatus()).catch(error => {
        window.__kpStartup?.issue('kpatch-status', error);
    });
    Promise.resolve().then(() => initInfo()).catch(error => {
        window.__kpStartup?.issue('device-info', error);
    });
});

// Overwrite default dialog animation
document.querySelectorAll('md-dialog').forEach(dialog => {
    const defaultOpenAnim = dialog.getOpenAnimation;
    const defaultCloseAnim = dialog.getCloseAnimation;

    dialog.getOpenAnimation = () => {
        const defaultAnim = defaultOpenAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'translateY(0)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0 }, { 'opacity': 0.32 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };

    dialog.getCloseAnimation = () => {
        const defaultAnim = defaultCloseAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-50px)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0.32 }, { 'opacity': 0 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };
});
