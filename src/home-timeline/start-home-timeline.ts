import { readHomeTimeline } from './read-home-timeline';
import { clearHomeTimeline, updateHomeTimeline } from './update-home-timeline';

const retryDelay = 1000;

/** Start observing X; the returned function releases all resources and markers. */
export function startHomeTimeline(): () => void {
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let nextAttemptAt = 0;
  let queued = false;
  let stopped = false;

  function synchronize(): void {
    clearTimeout(retryTimer);
    const timeline = readHomeTimeline(document, location.pathname);
    updateHomeTimeline(document, timeline);

    if (timeline.status !== 'ready' || timeline.selection === 'other') {
      nextAttemptAt = 0;
      return;
    }

    const now = Date.now();
    if (now >= nextAttemptAt) {
      nextAttemptAt = now + retryDelay;
      timeline.following.click();
    }
    // Hydration may ignore the first click. DOM churn must not cause click bursts.
    retryTimer = setTimeout(schedule, Math.max(0, nextAttemptAt - Date.now()));
  }

  function schedule(): void {
    if (queued || stopped) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!stopped) synchronize();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-selected', 'role', 'data-testid'],
  });
  // Navigation API covers pushState/replaceState in Chrome without patching X.
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  window.addEventListener('popstate', schedule);
  navigation?.addEventListener('navigatesuccess', schedule);
  schedule();

  return () => {
    stopped = true;
    observer.disconnect();
    clearTimeout(retryTimer);
    window.removeEventListener('popstate', schedule);
    navigation?.removeEventListener('navigatesuccess', schedule);
    clearHomeTimeline(document);
  };
}
