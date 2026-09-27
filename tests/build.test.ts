// @vitest-environment node
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('builds a self-contained MV3 content script and stylesheet', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'x-extension-'));
  let dom: JSDOM | undefined;
  const observers: MutationObserver[] = [];
  try {
    await build({ build: { outDir, emptyOutDir: true }, logLevel: 'silent' });
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.content_scripts[0].run_at).toBe('document_start');
    expect(manifest.content_scripts[0].matches).toEqual(['https://x.com/*', 'https://www.x.com/*']);
    const files: string[] = [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css];
    for (const file of files) await access(join(outDir, file));
    const script = await readFile(join(outDir, 'content.js'), 'utf8');
    // Content scripts are classic scripts: unresolved ES imports must fail this check.
    expect(() => new Script(script)).not.toThrow();
    const css = await readFile(join(outDir, 'content.css'), 'utf8');
    dom = new JSDOM(`<style>${css}</style><main data-testid="primaryColumn">
      <nav role="tablist"><button role="tab" aria-selected="true">おすすめ</button>
      <button role="tab" aria-selected="false">フォロー中</button></nav><section>Post</section>
      </main>`, { url: 'https://x.com/home', runScripts: 'outside-only' });
    const { document } = dom.window;
    const Observer = dom.window.MutationObserver;
    dom.window.MutationObserver = class extends Observer {
      constructor(callback: MutationCallback) {
        super(callback);
        observers.push(this);
      }
    };
    const [recommended, following] = document.querySelectorAll('button');
    following!.addEventListener('click', () => {
      recommended!.setAttribute('aria-selected', 'false');
      following!.setAttribute('aria-selected', 'true');
    });
    dom.window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(following!.getAttribute('aria-selected')).toBe('true');
    expect(dom.window.getComputedStyle(recommended!).display).toBe('none');
    expect(dom.window.getComputedStyle(document.querySelector('section')!).visibility).toBe('visible');
  } finally {
    observers.forEach((observer) => observer.disconnect());
    dom?.window.close();
    await rm(outDir, { recursive: true, force: true });
  }
});
