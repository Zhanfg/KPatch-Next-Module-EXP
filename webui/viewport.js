/** Keep bottom navigation at its physical bottom when the Android IME opens.
 * Material dialogs are allowed to reposition into the unobscured viewport.
 * No global focus scroll / window resize hacks are applied.
 */
export function installImeViewportGuard() {
    const doc = document.documentElement;
    const vv = window.visualViewport;
    let stableHeight = Math.max(window.innerHeight, vv?.height || 0);
    let stableWidth = window.innerWidth;
    let trackedEditableFocus = false;
    const isEditable = (el) => !!el && (
        el.matches?.('input,textarea,[contenteditable="true"],md-outlined-text-field,md-filled-text-field') ||
        !!el.closest?.('md-outlined-text-field,md-filled-text-field,[contenteditable="true"]')
    );
    function sync() {
        const width = window.innerWidth;
        if (Math.abs(width - stableWidth) > 50) {
            stableWidth = width;
            stableHeight = Math.max(window.innerHeight, vv?.height || 0);
        }
        const focus = document.activeElement;
        const editing = trackedEditableFocus || isEditable(focus) ||
            (!!focus?.shadowRoot?.activeElement && isEditable(focus.shadowRoot.activeElement));
        const visibleHeight = Math.min(window.innerHeight, vv?.height || window.innerHeight);
        if (!editing) stableHeight = Math.max(stableHeight, visibleHeight);
        const occluded = Math.max(0, stableHeight - visibleHeight - (vv?.offsetTop || 0));
        const keyboardOpen = editing && occluded > 120;
        doc.classList.toggle('kp-ime-visible', keyboardOpen);
        doc.style.setProperty('--kp-ime-occlusion', keyboardOpen ? Math.round(occluded) + 'px' : '0px');
        if (!editing) stableHeight = Math.max(stableHeight, visibleHeight);
    }
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    document.addEventListener('focusin', (e) => {
        trackedEditableFocus = isEditable(e.target) ||
            (typeof e.composedPath === 'function' && e.composedPath().some(isEditable));
        requestAnimationFrame(sync);
    }, true);
    document.addEventListener('focusout', () => {
        requestAnimationFrame(() => {
            const focus = document.activeElement;
            trackedEditableFocus = isEditable(focus) ||
                (!!focus?.shadowRoot?.activeElement && isEditable(focus.shadowRoot.activeElement));
            sync();
        });
    }, true);
    sync();
}
