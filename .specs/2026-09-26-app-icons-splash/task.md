# Tasks: New App Icons and Splash Screens

## 1. Vendor sources and generator

- [x] 1.1 Copy the sources from the generator zips into `.specs/2026-09-26-app-icons-splash/assets/source/`:
  - `launchericon-512x512.png` (PWABuilder `android/`) - transparent RGBA master, alpha bbox `(99, 35, 426, 472)`
  - `progressier-readme.txt` - device list + media queries for the launch images
  - PWABuilder `windows/Square44x44Logo.targetsize-*` were checked and dropped: `targetsize-256` has bbox `(49, 17, 213, 236)`, exactly half the master, so they add nothing.
- [x] 1.2 `assets/generate.py` (Pillow, LANCZOS on premultiplied `RGBa`, `optimize=True`) crops the master to its alpha bbox and writes into `app/public/`:
  - `favicon.ico` (16 + 32 + 48, notebook at full height)
  - `images/icons/icon-32x32.png`
  - `images/icons/icon-192x192.png`, `icon-512x512.png` - transparent, notebook at 86% height (vendor framing), purpose `any`
  - `images/icons/apple-touch-icon-180x180.png` - opaque `#f5f0e8`, notebook at 80% height (iOS fills transparency with black)
  - `images/icons/icon-maskable-{192x192,512x512}.png` - opaque `#f5f0e8`, notebook at 62% height: 0.464 x 0.62 has a half-diagonal of 0.387, inside the 0.40 safe-zone radius
  - `images/logo/logo-{16x16,32x32,28x38,56x76,64x64,128x128}.png` - transparent, fitted and centered. Names follow `PlannerIcon`'s existing `${width}x${height}` template so `srcSet` is `${2w}x${2h}`.
  - `images/splash/ios/apple-splash-{w}x{h}.png` - 22 devices x portrait/landscape = 44, opaque `#f5f0e8`, notebook centered at the per-device height measured from Progressier's output (`IOS_DEVICES` table). Progressier's "iPhone Duo (Open/Closed)" entries were dropped: unreleased device, width > height in "portrait".
  - Rewrites the block between `<!-- apple-touch-startup-image:start ... -->` and `<!-- apple-touch-startup-image:end -->` in `app/index.html`, so tags and files come from the same table.
  - Kept lossless RGB: palette quantization saved ~40% but showed up to 13 levels of banding in the shadow.
- [x] 1.3 Deleted `app/public/images/bulletjournal-planner-*.png`.

## 2. Wire up

- [x] 2.1 `app/public/manifest.webmanifest` + `manifest.dev.webmanifest`: `icon-192x192` / `icon-512x512` (`any`), `icon-maskable-192x192` / `icon-maskable-512x512` (`maskable`). `background_color` stays `#f5f0e8` (Android splash).
- [x] 2.2 `app/index.html`: `favicon.ico` (`sizes="16x16 32x32 48x48"`), PNG favicon 32, `apple-touch-icon` 180, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`, 44 generated startup-image links.
- [x] 2.3 `app/vite.config.ts`: `workbox.globIgnores: ['**/images/splash/**']`. Build precaches 16 entries: icons, logos, favicon, JS, CSS; no launch image.
- [x] 2.4 `app/src/components/Sidebar.tsx` `PlannerIcon`: `src=/images/logo/logo-${w}x${h}.png`, `srcSet=/images/logo/logo-${2w}x${2h}.png 2x`. Covers Sidebar (16x16 collapsed, 28x38 expanded) and `StyleguidePage.tsx` (28x38) with no change there.
- [x] 2.5 `app/src/components/AuthShell.tsx`: `logo-64x64.png` + `srcSet logo-128x128.png 2x`.
- [x] 2.6 `README.md`: `app/public/images/logo/logo-128x128.png`.

## 3. Tests

- [x] 3.1 `app/src/test/pwaAssets.test.ts` (reads PNG IHDR / ICO directory bytes, no image dependency):
  - both manifests list exactly `any` 192/512 + `maskable` 192/512; every file exists with the declared size; maskable files are opaque and differ from `any`; cream background/theme
  - `favicon.ico` holds 16/32/48; apple-touch-icon is an opaque 180x180; PNG favicon 32
  - 44 unique startup-image links; each file is `device-width x dpr` by `device-height x dpr` (swapped in landscape) and opaque; no orphan launch image on disk
  - every in-app logo exists at its size with alpha
  - no `bulletjournal-planner` file or reference left in `index.html`, manifests, README, `app/src`
- [x] 3.2 `Sidebar.test.tsx` (expanded 28x38 + collapsed 16x16, with 2x `srcset`), new `AuthShell.test.tsx` (64x64 + 128x128 2x).
- [x] 3.3 `app/e2e/appIcons.spec.ts`: every icon / apple-touch-icon / 44 startup-image link in the served `index.html` returns 200 `image/*`; the linked manifest lists 2 `any` + 2 `maskable` icons, all served as `image/png`; on a 2x screen the login logo's `currentSrc` is `logo-128x128.png` (`naturalWidth` is density-corrected, so it reads 64, not 128).

## 4. Verify

- [x] 4.1 `npm run lint` (0 errors), `npm test` (all pass), `npm run build` in `app/`.
- [x] 4.2 Playwright screenshots to `app/dist/screenshots/` (copies in `screenshots/` here for the PR): `login-desktop`, `login-mobile`, `app-desktop`, `sidebar-logo`, `icons-sheet` (tab, Pixel circle, Samsung squircle, iPhone, desktop install, Android launch, in-app logos), `ios-launch-screens`.

## Follow-ups

- At 16px the notebook reads as a pale rectangle on light tab bars (the artwork is near-white paper). A simplified small-size mark (ink outline or brick-red spine) would read better; needs a design decision.
