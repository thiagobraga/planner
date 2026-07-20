# Help Page Implementation Task List

This detailed task list tracks the implementation of the new `/help` page.

## 1. Component & Layout Setup (`app/src/pages/HelpPage.tsx`)
- [x] Create a new `HelpPage.tsx` file inside `app/src/pages/`.
- [x] Create the main `HelpPage` component container.
- [x] Implement a responsive flex layout:
  - [x] Main content column (max-width `640px`) centered with padding.
  - [x] Right sidebar column (width `200px`) for the Table of Contents, sticky positioned `top-12`.
  - [x] Hide the right sidebar on smaller screens (`hidden lg:block`).

## 2. Help Content Sections
- [x] **Header**: Add "Help" title and "Learn how to use Planner" subtitle.
- [x] **Welcome**: Add a brief introduction about Planner's purpose and capabilities.
- [x] **Getting Started**:
  - [x] Document creating tasks (QuickAdd, Enter).
  - [x] Document completing tasks (toggling the bullet).
  - [x] Document inline editing.
  - [x] Document task vs. note types (dash vs bullet).
- [x] **Views**:
  - [x] Describe Daily, Inbox, Monthly, and Upcoming views.
- [x] **Habits**:
  - [x] Describe Timeline and Calendar views.
  - [x] Explain unbroken chains and sub-habits.
- [x] **Collections & Tags**:
  - [x] Detail collection nesting (up to 4 levels).
  - [x] Explain drag-and-drop filing.
  - [x] Mention `@label` chip tags.
- [x] **Keyboard Shortcuts**:
  - [x] Build a clean table mapping keys to actions.
  - [x] Use the `<kbd>` HTML tag to render keys (which leverages existing `index.css` styling).
- [x] **Settings**:
  - [x] Mention font choices (Lora, Playpen Sans, Hubballi).
  - [x] Mention dot-grid toggle, theme toggle, and small caps.

## 3. Table of Contents & Scroll Spying
- [x] Define a React state variable `activeSection` to track the visible section.
- [x] Render navigation anchor links (`<a href="#section-id">`) in the right sidebar.
- [x] Add an active highlight state using a left border and text color change (e.g. `border-l-2 text-ink`).
- [x] Set up an `IntersectionObserver` in a `useEffect` hook to watch all `<section>` elements.
- [x] Sort `IntersectionObserver` visible entries to accurately determine which section is closest to the top of the viewport.
- [x] Update `activeSection` state dynamically as the user scrolls.
- [x] Create a `scrollToSection` handler for smooth scrolling when a TOC link is clicked, and to manually update the URL hash.

## 4. Navigation & Routing Updates
- [x] **`app/src/App.tsx`**:
  - [x] Import `HelpPage`.
  - [x] Add `<Route path="/help" element={<HelpPage />} />` under the authenticated `AppRoutes` block.
- [x] **`app/src/components/Sidebar.tsx`**:
  - [x] Locate the Help button in the collapsed sidebar (`collapsed === true` return block).
  - [x] Replace the `<a>` tag and `onClick` handler with a `<NavLink to="/help">`.
  - [x] Apply the active class matching (`sidebar-icon-link--active`) for the collapsed navigation.
  - [x] Locate the Help button in the expanded sidebar drawer.
  - [x] Update `<SidebarNavItem>` to pass `to="/help"` instead of `onClick={onOpenHelp}`.
- [x] **`app/src/components/AppShell.tsx`**:
  - [x] Remove the unused `onOpenHelp` prop passed to `<Sidebar>`.
  - [x] Maintain the `?` keyboard shortcut behavior that toggles the `HelpDialog` modal independently of the `/help` route.

## 5. Verification & Testing
- [x] Ensure `npm run lint` passes without any unused variable warnings (e.g., removing `onOpenHelp` from `SidebarProps`).
- [x] Build the app via `vite build` to ensure no TypeScript type errors were introduced.
- [x] Verify visual accuracy against the provided ChatGPT mockup (colors, font, spacing).
