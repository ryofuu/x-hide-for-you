# X Hide For You

A Chrome extension that hides X's **For you** tab and switches to **Following**. Supports English and Japanese interfaces and preserves pinned list selections.

Built with TypeScript, pnpm, Vite, and Vitest. No data collection or external requests.

## Build

Requires Node.js 24.15.0+ and pnpm 10.28.2.

```sh
pnpm install --frozen-lockfile
pnpm build
```

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `dist/` folder.
3. Reload X.

After rebuilding, reload the extension in Chrome and refresh X.

## Development

```sh
pnpm dev         # Rebuild on changes
pnpm test        # Run integration and build tests
pnpm test:watch  # Watch tests
pnpm typecheck   # Check TypeScript types
pnpm check       # Run tests, type checking, and production build
```

## Structure

- `src/content/` — Content script entry point.
- `src/home-timeline/` — State detection, visibility, tab switching, and integration tests.
- `public/manifest.json` — Chrome Manifest V3 configuration.
- `tests/` — Build output verification.

## Limitations

Only affects the home timeline on `x.com` and `www.x.com`; it does not block post requests. Changes to X's markup may require updates. If the home tabs cannot be identified, the feed stays hidden. Tests use jsdom; live X behavior requires manual verification.
