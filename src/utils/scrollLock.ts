/**
 * Scroll lock utility for drawers, lightboxes, and modals.
 * Uses CSS class instead of inline style for better debugging and consistency.
 */

const LOCK_CLASS = "scroll-locked";

export function lockScroll(): void {
    document.body.classList.add(LOCK_CLASS);
}

export function unlockScroll(): void {
    document.body.classList.remove(LOCK_CLASS);
}

export function isScrollLocked(): boolean {
    return document.body.classList.contains(LOCK_CLASS);
}
