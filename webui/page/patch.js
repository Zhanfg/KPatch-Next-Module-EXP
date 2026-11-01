import { iconSvg } from '../icons.js';
import { showKpmControlDialog, getQueuedBootOptions, clearQueuedBootOptions } from '../kpm-control.js';
import { exec, spawn, toast } from 'kernelsu-alt';
import { modDir, escapeShell } from '../index.js';
import { handleFileUpload, uploadFile } from './kpm.js';
import { getString } from '../language.js';

function uInt2String(ver) {
    const val = typeof ver === 'string' ? parseInt(ver, 16) : ver;

    const major = (val & 0xff0000) >> 16;
    const minor = (val & 0x00ff00) >> 8;
    const patch = (val & 0x0000ff);

    return `${major}.${minor}.${patch}`;
}

function parseIni(str) {
    const result = {};
    let currentSection = null;
    str.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith(';')) return;
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1);
            result[currentSection] = {};
        } else if (line.includes('=')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (currentSection) {
                result[currentSection][key] = value;
            } else {
                result[key] = value;
            }
        }
    });
    return result;
}

async function getInstalledVersion() {
    if (import.meta.env.DEV) return uInt2String('c06');
    const working = await exec(`kpatch hello`, { env: { PATH: `${modDir}/bin` } });
    if (working.stdout.trim() === '') return null;
    const version = await exec(`kpatch kpver`, { env: { PATH: `${modDir}/bin` } });
    return uInt2String(version.stdout.trim());
}

let bootSlot = '';
let bootDev = '';
let kimgInfo = { banner: '', patched: false };
let kpimgInfo = { version: '', compile_time: '', config: '' };
let existedExtras = [];
let newExtras = [];

async function getKpimgInfo() {
    if (kpimgInfo.version) {
        document.getElementById('kpimg-version').textContent = getString('info_version', uInt2String(kpimgInfo.version));
        document.getElementById('kpimg-time').textContent = getString('info_time', kpimgInfo.compile_time);
        document.getElementById('kpimg-config').textContent = getString('info_config', kpimgInfo.config);
        document.getElementById('kpimg').classList.remove('animate-hidden');
        return;
    }
    const result = await exec(`kptools -l -k ${modDir}/bin/kpimg`, { env: { PATH: `${modDir}/bin` } });
    if (import.meta.env.DEV) {
        result.stdout = `[kpimg]\nversion=0xc06\ncompile_time=11:08:10 Dec 30 2025\nconfig=linux,release`;
    }
    const ini = parseIni(result.stdout);
    if (ini.kpimg) {
        kpimgInfo.version = ini.kpimg.version;
        kpimgInfo.compile_time = ini.kpimg.compile_time;
        kpimgInfo.config = ini.kpimg.config;

        document.getElementById('kpimg-version').textContent = getString('info_version', uInt2String(ini.kpimg.version));
        document.getElementById('kpimg-time').textContent = getString('info_time', ini.kpimg.compile_time);
        document.getElementById('kpimg-config').textContent = getString('info_config', ini.kpimg.config);
    }
    document.getElementById('kpimg').classList.remove('animate-hidden');
}

function extractBootimg(bootDev) {
    const child = spawn('magiskboot', ['unpack', bootDev], {
        cwd: `${modDir}/tmp`,
        env: { PATH: `${modDir}/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH` }
    });
    child.on('exit', () => {
        parseBootimg();
    });
}

async function parseBootimg() {
    if (import.meta.env.DEV) {
        document.getElementById('kernel-info').textContent = `6.18-Linux`;
        document.getElementById('kernel').classList.remove('animate-hidden');
        return;
    }

    let stdout = '', stderr = '';
    const result = spawn('kptools', ['-l', '-i', 'kernel'], {
        cwd: `${modDir}/tmp`,
        env: { PATH: `${modDir}/bin:${modDir}/tmp:$PATH` }
    });

    result.stdout.on('data', (data) => stdout += data + '\n');
    result.stderr.on('data', (data) => stderr += data);

    const errno = await new Promise((resolve) => {
        result.on('exit', (code) => resolve(code));
    });

    if (errno !== 0) {
        toast(getString('msg_failed_parse_kernel', stderr));
        return;
    }

    const ini = parseIni(stdout);

    if (ini.kernel) {
        kimgInfo.banner = ini.kernel.banner;
        kimgInfo.patched = ini.kernel.patched === 'true';

        // Kernel info card
        document.getElementById('kernel-info').textContent = kimgInfo.banner;
        document.getElementById('kernel').classList.remove('animate-hidden');

        if (kimgInfo.patched && ini.kpimg) {
            // Parse extras
            existedExtras = [];
            let kpmNum = parseInt(ini.kernel.extra_num);
            if (isNaN(kpmNum) && ini.extras) {
                kpmNum = parseInt(ini.extras.num);
            }

            if (kpmNum > 0) {
                for (let i = 0; i < kpmNum; i++) {
                    const extra = ini[`extra ${i}`];
                    if (extra && extra.type.toUpperCase() === 'KPM') {
                        existedExtras.push({
                            type: 'KPM',
                            name: extra.name,
                            event: getQueuedBootOptions(extra.name)?.event || extra.event || 'pre-kernel-init',
                            args: getQueuedBootOptions(extra.name)?.args ?? extra.args ?? '',
                            version: extra.version,
                            license: extra.license,
                            author: extra.author,
                            description: extra.description,
                            isNew: false
                        });
                    }
                }
            }
        }
        renderKpmList();
    }
}

async function extractAndParseBootimg() {
    if (bootDev) {
        document.getElementById('bootimg').classList.remove('animate-hidden');
        extractBootimg(bootDev);
        return;
    }

    // Prepare work directory
    const prepare = spawn(`mkdir -p ${modDir}/tmp && rm -rf ${modDir}/tmp/* && cp ${modDir}/bin/kpimg ${modDir}/tmp/`);
    await new Promise((resolve) => {
        prepare.on('exit', () => resolve());
    });

    // get slot and device
    const result = spawn('busybox', ['sh', `${modDir}/patch/boot_extract.sh`], {
        env: { PATH: `${modDir}/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH`, ASH_STANDALONE: '1' }
    });

    result.stdout.on('data', (data) => {
        if (data.match(/SLOT=(.*)/)) {
            bootSlot = data.match(/SLOT=(.*)/)[1].trim();
        } else if (data.match(/BOOTIMAGE=(.*)/)) {
            bootDev = data.match(/BOOTIMAGE=(.*)/)[1].trim();
        }
    });

    let stderr = '';
    result.stderr.on('data', (data) => stderr += data);

    const errno = await new Promise((resolve) => {
        result.on('exit', (code) => resolve(code));
    });

    if (errno !== 0 && !import.meta.env.DEV) {
        toast(getString('msg_boot_extract_failed'), stderr);
        document.getElementById('bootimg-device').textContent = getString('msg_failed_locate_boot');
        return;
    }

    // Bootimg info card
    document.getElementById('bootimg-slot').textContent = bootSlot ? getString('info_slot', bootSlot) : '';
    document.getElementById('bootimg-device').textContent = bootDev ? getString('info_device', bootDev) : getString('info_device_unknown');
    document.getElementById('bootimg').classList.remove('animate-hidden');

    if (bootDev || import.meta.env.DEV) {
        extractBootimg(bootDev);
    }
}

function renderKpmList() {
    const list = document.getElementById('kpm-embed-list');
    list.innerHTML = '';

    const createCard = (item, index, isNew) => {
        const card = document.createElement('div');
        card.className = 'card module-card';
        card.innerHTML = `
            <div class="module-card-header">
                <div class="flex-header">
                    <div class="module-card-title">${item.name}</div>
                    ${isNew ? '' : '<div class="tag">' + getString('info_embedded') + '</div>'}
                </div>
                <div class="module-card-subtitle">${item.version}, ${getString('info_author', item.author || getString('msg_unknown'))}</div>
                <div class="module-card-subtitle">${getString('info_args', item.args ? item.args : '(null)')}</div>
            </div>
            <div class="module-card-content">
                <div class="module-card-text">${item.description || getString('info_no_description')}</div>
            </div>
            <md-divider></md-divider>
            <div class="module-card-actions">
                <button type="button" class="control kpm-action">
                    ${iconSvg('tune')}
                <span>${getString('button_config')}</span></button>
                <button type="button" class="unload kpm-action kpm-danger">
                    ${iconSvg('delete')}
                <span>${getString('button_remove')}</span></button>
            </div>
        `;

        card.querySelector('.control').onclick = () => openOptionDialog(item);
        card.querySelector('.unload').onclick = () => {
            if (isNew) {
                newExtras.splice(index, 1);
            } else {
                existedExtras.splice(index, 1);
            }
            renderKpmList();
        };

        return card;
    };

    const appendCard = (item, idx, isNew) => {
        const card = createCard(item, idx, isNew);
        list.appendChild(card);
    }

    existedExtras.forEach((item, idx) => appendCard(item, idx, false));
    newExtras.forEach((item, idx) => appendCard(item, idx, true));
}

function openOptionDialog(item) {
    showKpmControlDialog({
        moduleName: item.name,
        mode: 'embed',
        event: item.event,
        embedArgs: item.args || '',
        onEmbed: (event, args) => {
            item.event = event;
            item.args = args;
            renderKpmList();
        }
    });
}

async function embedKPM() {
    const embedBtn = document.getElementById('embed');
    const startBtn = document.getElementById('start');
    handleFileUpload('.kpm', 'kpm-embed-list', async (file, onProgress, signal) => {
        embedBtn.disabled = true;
        startBtn.disabled = true;

        // Generate random filename
        const randName = Math.random().toString(36).substring(7) + '.kpm';
        const tmpPath = `${modDir}/tmp/${randName}`;

        try {
            await uploadFile(file, tmpPath, onProgress, signal);
        } catch (e) {
            exec(`rm -f ${tmpPath}`);
            throw e;
        } finally {
            embedBtn.disabled = false;
            startBtn.disabled = false;
        }

        const result = await exec(`kptools -l -M "${randName}"`, {
            cwd: `${modDir}/tmp`,
            env: { PATH: `${modDir}/bin:$PATH` }
        });

        if (result.errno) {
            toast(getString('msg_invalid_kpm_file'));
            return;
        }

        const ini = parseIni(result.stdout);
        if (ini.kpm) {
            newExtras.push({
                type: 'KPM',
                name: ini.kpm.name,
                event: 'pre-kernel-init', // default
                args: '',
                version: ini.kpm.version,
                license: ini.kpm.license,
                author: ini.kpm.author,
                description: ini.kpm.description,
                fileName: randName,
                isNew: true
            });
            renderKpmList();
        } else {
            toast(getString('msg_could_not_parse_kpm'));
        }
    });
}

function patch(type) {
    const terminal = document.querySelector('#patch-terminal');
    const pageContent = terminal.closest('.page-content');
    const flashToDevice = document.getElementById('flash-to-device');

    const onOutput = (data) => {
        terminal.innerHTML += `<div>${data}</div>`;
        pageContent.scrollTo({ top: pageContent.scrollHeight, behavior: 'smooth' });
    };

    if (!bootDev) {
        terminal.textContent = getString('msg_error_no_boot_image');
        return;
    }

    let args = ['sh'];
    if (type === "patch") {
        args.push(
            `${modDir}/patch/boot_patch.sh`,
            bootDev,
            flashToDevice.selected ? 'true' : 'false'
        );

        // New kpm
        newExtras.forEach(extra => {
            args.push('-M', `${modDir}/tmp/${extra.fileName}`);
            if (extra.args) args.push('-A', escapeShell(extra.args));
            if (extra.event) args.push('-V', extra.event);
            args.push('-T', 'kpm');
        });

        // Embeded kpm
        existedExtras.forEach(extra => {
            args.push('-E', extra.name);
            if (extra.args) args.push('-A', escapeShell(extra.args));
            if (extra.event) args.push('-V', extra.event);
            args.push('-T', 'kpm');
        });
    } else {
        // Unpatch logic
        args.push(`${modDir}/patch/boot_unpatch.sh`, bootDev);
    }

    const process = spawn(
        `busybox`,
        args,
        {
            cwd: `${modDir}/tmp`,
            env: {
                PATH: `${modDir}/bin:/data/adb/ksu/bin:/data/adb/magisk:$PATH`,
                ASH_STANDALONE: '1'
            }
        }
    );
    process.stdout.on('data', onOutput);
    process.stderr.on('data', onOutput);
    process.on('exit', (code) => {
        if (code === 0) {
            document.getElementById('reboot-fab').classList.remove('hide');
            bootSlot = '';
            bootDev = '';
            kimgInfo = { banner: '', patched: false };
            newExtras = [];
            // Only clear staged boot options after a successful patch.
            clearQueuedBootOptions();
        }
        exec(`rm -rf ${modDir}/tmp`);
    });
}

export { getKpimgInfo, extractAndParseBootimg, getInstalledVersion, patch, embedKPM }
