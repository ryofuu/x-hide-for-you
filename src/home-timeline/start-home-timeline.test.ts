import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHomeTimeline } from './start-home-timeline';
import styles from './home-timeline.css?inline';

// Flush MutationObserver callbacks and the controller's queued synchronization.
async function settle(): Promise<void> {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

function fixture({ english = false, selected = 'recommended', acceptClicks = true } = {}) {
  document.body.innerHTML = `<main data-testid="primaryColumn">
    <nav role="tablist">
      <a role="tab" id="recommended">${english ? 'For you' : 'おすすめ'}</a>
      <a role="tab" id="following">${english ? 'Following' : 'フォロー中'}</a>
      <a role="tab" id="list">My list</a>
    </nav><section><article>A post</article></section>
  </main>`;
  const primary = document.querySelector('main')!;
  const recommended = document.getElementById('recommended')!;
  const following = document.getElementById('following')!;
  const nav = document.querySelector('nav')!;
  function select(id: string): void {
    nav.querySelectorAll('[role="tab"]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.id === id));
    });
  }
  select(selected);
  const click = vi.fn((event: Event) => {
    event.preventDefault();
    if (acceptClicks) select('following');
  });
  following.addEventListener('click', click);
  return { primary, recommended, following, nav, select, click };
}

let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  history.replaceState({}, '', '/home');
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.append(style);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  document.head.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('home timeline integration', () => {
  it.each([false, true])('switches and hides recommendations (English: %s)', async (english) => {
    const f = fixture({ english });
    stop = startHomeTimeline();
    await settle();
    expect(f.following.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(f.recommended).display).toBe('none');
    expect(getComputedStyle(document.querySelector('section')!).visibility).toBe('visible');
    expect(f.click).toHaveBeenCalledTimes(1);
  });

  it.each(['following', 'list'])('preserves the %s tab', async (selected) => {
    const f = fixture({ selected });
    stop = startHomeTimeline();
    await settle();
    expect(f.click).not.toHaveBeenCalled();
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(false);
  });

  it('blocks posts and retries only once per second until hydration completes', async () => {
    const f = fixture({ acceptClicks: false });
    stop = startHomeTimeline();
    await settle();
    expect(getComputedStyle(document.querySelector('section')!).visibility).toBe('hidden');
    for (let index = 0; index < 5; index++) {
      f.primary.append(document.createElement('div'));
      await settle();
    }
    expect(f.click).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(f.click).toHaveBeenCalledTimes(1);
    f.following.addEventListener('click', () => f.select('following'), { once: true });
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(f.click).toHaveBeenCalledTimes(2);
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles delayed primary column and navigation rendering', async () => {
    const f = fixture();
    f.primary.remove();
    f.nav.remove();
    stop = startHomeTimeline();
    await settle();
    document.body.append(f.primary);
    await settle();
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(true);
    f.primary.prepend(f.nav);
    await settle();
    expect(f.following.getAttribute('aria-selected')).toBe('true');
  });

  it('switches back if X selects recommendations again', async () => {
    const f = fixture();
    stop = startHomeTimeline();
    await settle();
    f.select('recommended');
    await settle();
    expect(f.following.getAttribute('aria-selected')).toBe('true');
    expect(f.click).toHaveBeenCalledTimes(2);
  });

  it.each(['/search', '/notifications', '/someone', '/someone/status/1', '/home/other'])
    ('does not modify %s', async (path) => {
      history.replaceState({}, '', path);
      const f = fixture();
      stop = startHomeTimeline();
      await settle();
      expect(f.click).not.toHaveBeenCalled();
      expect(document.querySelector('[data-x-hide-for-you], [data-x-block-home-feed]')).toBeNull();
    });

  it('handles SPA entry and exit through navigation events without DOM changes', async () => {
    const navigation = new EventTarget();
    vi.stubGlobal('navigation', navigation);
    history.replaceState({}, '', '/search');
    const f = fixture({ acceptClicks: false });
    stop = startHomeTimeline();
    await settle();
    history.pushState({}, '', '/home');
    navigation.dispatchEvent(new Event('navigatesuccess'));
    await settle();
    expect(f.click).toHaveBeenCalledTimes(1);
    history.pushState({}, '', '/someone');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(false);
    expect(getComputedStyle(f.recommended).display).not.toBe('none');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('blocks unknown tabs without clicking unrelated navigation or dialogs', async () => {
    const f = fixture();
    const outside = f.nav.cloneNode(true) as HTMLElement;
    const outsideClick = vi.fn();
    outside.addEventListener('click', outsideClick);
    document.body.prepend(outside);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.append(f.nav);
    f.primary.prepend(dialog);
    stop = startHomeTimeline();
    await settle();
    expect(f.click).not.toHaveBeenCalled();
    expect(outsideClick).not.toHaveBeenCalled();
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(true);
  });

  it('waits safely for supported labels to arrive', async () => {
    const f = fixture();
    f.following.textContent = 'Loading';
    stop = startHomeTimeline();
    await settle();
    expect(f.click).not.toHaveBeenCalled();
    expect(f.primary.hasAttribute('data-x-block-home-feed')).toBe(true);
    f.following.textContent = 'フォロー中';
    await settle();
    expect(f.click).toHaveBeenCalledTimes(1);
  });

  it('switches when no tab has a selected state yet', async () => {
    const f = fixture({ selected: 'none' });
    stop = startHomeTimeline();
    await settle();
    expect(f.following.getAttribute('aria-selected')).toBe('true');
  });

  it('releases observers, listeners, timers and markers when stopped', async () => {
    const f = fixture({ acceptClicks: false });
    stop = startHomeTimeline();
    await settle();
    f.primary.append(document.createElement('div'));
    stop();
    await settle();
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.click).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('[data-x-hide-for-you], [data-x-block-home-feed]')).toBeNull();
  });

  it('can stop before its initial microtask runs', async () => {
    const f = fixture();
    stop = startHomeTimeline();
    stop();
    await settle();
    expect(f.click).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
