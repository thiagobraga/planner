# Tasks: New App Icons and Splash Screens

## 1. Vendor sources and generator

- [ ] 1.1 Copy the source files from the generator zips into `.specs/2026-09-26-app-icons-splash/assets/source/`:
  - `launchericon-512x512.png` (PWABuilder `android/`) - transparent RGBA master, notebook bbox 96..426 x 34..472
  - `targetsize-{16,32,48,256}.png` (PWABuilder `windows/Square44x44Logo.targetsize-*`) - tight crops, readable at tiny sizes
  - `progressier-readme.txt` - device list + media queries (source of truth for the 48 launch images)
- [ ] 1.2 Write `assets/generate.py` (Pillow, LANCZOS resampling, `optimize=True`), writing into `app/public/`:
  - `favicon.ico` from `targetsize-{16,32,48}`
  - `images/icons/icon-32.png` from `targetsize-32`
  - `images/icons/icon-192.png`, `icon-512.png` - transparent master resized (purpose `any`)
  - `images/icons/apple-touch-icon-180.png` - master on opaque `#f5f0e8`, notebook height 80%
  - `images/icons/icon-maskable-{192,512}.png` - master on opaque `#f5f0e8`, notebook height 62% so its corners stay inside the 80% safe-zone circle (0.48 x 0.64 -> diagonal 0.80)
  - `images/logo/logo-{16,32}.png` from `targetsize-{16,32}`, `logo-{64,128}.png` from `targetsize-256` (transparent)
  - `images/logo/logo-{28x38,56x76}.png` - master cropped to its alpha bbox, fitted and centered (transparent)
  - `images/splash/ios/apple-splash-{w}x{h}.png` - for each of the 24 Progressier devices x portrait/landscape: opaque `#f5f0e8` canvas, notebook fitted to the content bbox measured from the matching Progressier image, so size and position match exactly
- [ ] 1.3 Delete `app/public/images/bulletjournal-planner-*.png`.

## 2. Wire up

- [ ] 2.1 `app/public/manifest.webmanifest` + `manifest.dev.webmanifest`: icons `icon-192` / `icon-512` (`any`), `icon-maskable-192` / `icon-maskable-512` (`maskable`). `background_color` stays `#f5f0e8` (Android splash).
- [ ] 2.2 `app/index.html`:
  - `<link rel="icon" href="/favicon.ico" sizes="48x48">`, `<link rel="icon" type="image/png" sizes="32x32" href="/images/icons/icon-32.png">`
  - `<link rel="apple-touch-icon" sizes="180x180" href="/images/icons/apple-touch-icon-180.png">`
  - `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title="Planner"`, `apple-mobile-web-app-status-bar-style="default"`
  - 48 `<link rel="apple-touch-startup-image" media="(device-width) (device-height) (-webkit-device-pixel-ratio) (orientation)">` tags, generated from the same device table as the images
- [ ] 2.3 `app/vite.config.ts`: `workbox.globIgnores: ['**/images/splash/**']` so the service worker does not precache ~48 launch images per visitor.
- [ ] 2.4 `app/src/components/Sidebar.tsx` `PlannerIcon`: `src=/images/logo/logo-{w}x{h}.png` (square sizes `logo-{w}.png`) + `srcSet` 2x.
- [ ] 2.5 `app/src/components/AuthShell.tsx`: `logo-64.png` + `srcSet logo-128.png 2x`.
- [ ] 2.6 `README.md`: `app/public/images/logo/logo-128.png`.

## 3. Tests

- [ ] 3.1 `app/src/test/pwaAssets.test.ts` (reads PNG IHDR bytes, no image dependency):
  - every manifest icon exists and its pixel size matches `sizes`; both manifests list `any` 192/512 and `maskable` 192/512; maskable files differ from `any` files and are fully opaque
  - `index.html` has 48 startup-image links; each file exists and its size equals `device-width x dpr` by `device-height x dpr` (swapped in landscape)
  - every `/images/...` reference in `index.html` and the manifests exists
  - no file in `app/src`, `app/index.html`, manifests, README references `bulletjournal-planner`
- [ ] 3.2 Sidebar / AuthShell tests: logo `src` + `srcSet` point at `images/logo/`.
- [ ] 3.3 `app/e2e/appIcons.spec.ts`: favicon, apple-touch-icon, manifest icons and one startup image return 200 `image/png`; login page logo renders with `naturalWidth > 0`.

## 4. Verify

- [ ] 4.1 `npm run lint`, `npm test`, `npm run build` in `app/`.
- [ ] 4.2 Playwright screenshots to `app/dist/screenshots/`: login (desktop + narrow), sidebar logo, contact sheet of icons, sample launch screens. Post them in the PR.
