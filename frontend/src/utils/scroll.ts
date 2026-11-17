/**
 * Bring `el` into view by scrolling only its nearest scrollable ancestor. Unlike
 * Element.scrollIntoView, this never scrolls the page (or any outer container), and it does
 * nothing when the element sits inside a clipped, non-scrolling region such as a collapsed panel.
 */
export function revealInContainer(el: HTMLElement | null): void {
  if (!el) return;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (/(auto|scroll)/.test(overflowY) && p.scrollHeight > p.clientHeight) {
      const e = el.getBoundingClientRect();
      const c = p.getBoundingClientRect();
      if (e.top < c.top) p.scrollTop -= c.top - e.top;
      else if (e.bottom > c.bottom) p.scrollTop += e.bottom - c.bottom;
      return;
    }
    if (overflowY === 'hidden' || overflowY === 'clip') return; // clipped: don't scroll beyond it
  }
}
