import { getString } from './language.js';

const queuedBootOptions = new Map();
const KPM_EVENTS = new Set(['paging-init', 'pre-kernel-init', 'post-kernel-init']);

/** In-memory boot configuration proposal. No kernel state or boot partition is modified. */
export function queueBootOptions(name, event, args) {
    if (!name || typeof name !== 'string') throw new TypeError('A KPM name is required');
    if (!KPM_EVENTS.has(event)) throw new RangeError('Unsupported KPM boot event');
    queuedBootOptions.set(name, { event, args: String(args || '') });
}
export function getQueuedBootOptions(name) {
    return queuedBootOptions.get(name) || null;
}
export function clearQueuedBootOptions() {
    queuedBootOptions.clear();
}

/**
 * Shared dialog for separate KPM operations:
 * - runtime: kpm ctl0 command, takes effect now
 * - embed: edit next-boot image configuration, only applied via Repair/Patch
 * Never send embed args to ctl0, or vice versa.
 */
export function showKpmControlDialog({
    moduleName = '',
    mode = 'runtime',
    embedAvailable = false,
    runtimeValue = '',
    event = 'pre-kernel-init',
    embedArgs = '',
    onRuntime = null,
    onEmbed = null,
}) {
    const dialog = document.getElementById('control-dialog');
    const runtime = dialog.querySelector('#kpm-runtime-section');
    const embed = dialog.querySelector('#kpm-embed-section');
    const runtimeField = dialog.querySelector('#kpm-ctl0-input');
    const eventSelect = dialog.querySelector('#kpm-event-select');
    const embedField = dialog.querySelector('#kpm-args-input');
    const execute = dialog.querySelector('.confirm-runtime');
    const save = dialog.querySelector('.confirm-embed');
    const cancel = dialog.querySelector('.cancel');
    const hint = dialog.querySelector('#kpm-embed-hint');

    if (mode !== 'runtime' && mode !== 'embed') throw new RangeError('Invalid KPM control dialog mode');
    const showRuntime = mode === 'runtime';
    const showEmbed = mode === 'embed' || (showRuntime && embedAvailable);
    runtime.hidden = !showRuntime;
    embed.hidden = !showEmbed;
    execute.hidden = !showRuntime;
    save.hidden = !showEmbed;
    hint.hidden = mode === 'embed';
    runtimeField.value = runtimeValue;
    eventSelect.value = KPM_EVENTS.has(event) ? event : 'pre-kernel-init';
    embedField.value = embedArgs || '';
    execute.disabled = !runtimeField.value;
    execute.textContent = getString('button_execute_now');
    save.textContent = getString(mode === 'runtime' ? 'button_save_and_patch' : 'button_save_options');
    // Title is not a token: never append module names as HTML.
    const title = dialog.querySelector('[slot="headline"]');
    title.textContent = getString('title_control_kpmodule') + (moduleName ? ' · ' + moduleName : '');
    cancel.onclick = () => dialog.close();
    runtimeField.oninput = () => { execute.disabled = !runtimeField.value; };
    execute.onclick = async () => {
        if (!showRuntime || !runtimeField.value || !onRuntime) return;
        execute.disabled = true;
        try {
            await onRuntime(runtimeField.value);
            dialog.close();
        } finally {
            execute.disabled = false;
        }
    };
    save.onclick = () => {
        if (!showEmbed) return;
        const selectedEvent = eventSelect.value;
        if (!KPM_EVENTS.has(selectedEvent)) return;
        const args = embedField.value || '';
        if (onEmbed) {
            onEmbed(selectedEvent, args);
        } else if (moduleName) {
            queueBootOptions(moduleName, selectedEvent, args);
            window.dispatchEvent(new CustomEvent('kpm:open-patch'));
        }
        dialog.close();
    };
    dialog.show();
}
