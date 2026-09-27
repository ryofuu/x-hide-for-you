export type HomeTimeline =
  | { status: 'outside' }
  | { status: 'loading'; primary: HTMLElement | null }
  | {
      status: 'ready';
      primary: HTMLElement;
      recommended: HTMLElement;
      following: HTMLElement;
      selection: 'recommended' | 'other' | 'unknown';
    };

const recommendedLabels = new Set(['おすすめ', 'For you']);
const followingLabels = new Set(['フォロー中', 'Following']);

export function readHomeTimeline(document: Document, pathname: string): HomeTimeline {
  if (!/^\/(?:home\/?)?$/.test(pathname)) return { status: 'outside' };

  const primary = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  if (!primary) return { status: 'loading', primary: null };

  for (const tabList of primary.querySelectorAll('[role="tablist"]')) {
    if (tabList.closest('[role="dialog"]')) continue;
    const tabs = [...tabList.querySelectorAll<HTMLElement>('[role="tab"]')];
    const recommended = tabs.find((tab) => recommendedLabels.has(tab.textContent.trim()));
    const following = tabs.find((tab) => followingLabels.has(tab.textContent.trim()));
    if (!recommended || !following) continue;

    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    return {
      status: 'ready', primary, recommended, following,
      selection: !selected ? 'unknown' : selected === recommended ? 'recommended' : 'other',
    };
  }
  return { status: 'loading', primary };
}
