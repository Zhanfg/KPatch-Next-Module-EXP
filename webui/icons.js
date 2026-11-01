/* Fixed, font-independent icon geometry used by dynamic KPM cards.
 * All shapes render as inline SVG; no Unicode glyphs or icon-font ligatures. */
const ICON_PATHS = Object.freeze({
    tune: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15" cy="7" r="2" fill="var(--md-sys-color-surface, white)" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="17" r="2" fill="var(--md-sys-color-surface, white)" stroke="currentColor" stroke-width="2"/>',
    power: '<path d="M12 3v9M6.3 5.9A8 8 0 1 0 17.7 5.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    delete: '<path d="M7 5V3h10v2h4v2H3V5h4Zm-2 4h14l-1 12H6L5 9Zm4 2v7h2v-7H9Zm4 0v7h2v-7h-2Z"/>',
    close: '<path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4l-6.3 6.3-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3 1.4 1.4Z"/>',
});
export function iconSvg(name) {
    const path = ICON_PATHS[name];
    if (!path) throw new Error(`Unknown SVG icon: ${name}`);
    return `<svg class="kp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}
