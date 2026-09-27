import type { HomeTimeline } from './read-home-timeline';

const hiddenTab = 'data-x-hide-for-you';
const blockedFeed = 'data-x-block-home-feed';

export function clearHomeTimeline(document: Document): void {
  for (const element of document.querySelectorAll(`[${hiddenTab}], [${blockedFeed}]`)) {
    element.removeAttribute(hiddenTab);
    element.removeAttribute(blockedFeed);
  }
}

export function updateHomeTimeline(document: Document, timeline: HomeTimeline): void {
  // Remove stale markers when X reuses nodes during client-side navigation.
  clearHomeTimeline(document);
  if (timeline.status === 'outside') return;
  if (timeline.status === 'loading') {
    timeline.primary?.setAttribute(blockedFeed, '');
    return;
  }
  timeline.recommended.setAttribute(hiddenTab, '');
  timeline.primary.toggleAttribute(blockedFeed, timeline.selection !== 'other');
}
