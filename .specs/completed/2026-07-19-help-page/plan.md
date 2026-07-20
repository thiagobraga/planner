# Help Page Implementation Plan

## Goal
Implement a dedicated Help page for the Planner application based on the generated ChatGPT mockup. The Help page will replace the current modal dialog for the Help section in the sidebar, providing a comprehensive guide to the app's features, views, keyboard shortcuts, and settings.

## Proposed Changes

### Routing & App Shell (`app/src/App.tsx`, `app/src/components/AppShell.tsx`)
- Add `<Route path="/help" element={<HelpPage />} />` to `AppRoutes` in `App.tsx`.
- The `?` shortcut will continue to open the Help dialog in `AppShell` for quick reference anywhere, but the Sidebar link will route to `/help`.

### Navigation (`app/src/components/Sidebar.tsx`)
- Update the collapsed sidebar's Help icon to be a `NavLink` to `/help`.
- Update the drawer sidebar's Help `SidebarNavItem` to navigate to `/help` instead of triggering `onOpenHelp`.

### Help Page (`app/src/pages/HelpPage.tsx`)
Create a new page component with a two-column internal layout (content + sticky TOC):
- **Container**: `div` with `flex` to arrange content and sidebar.
- **Main Content**: `max-w-[640px]` centered column containing all the help sections (Welcome, Getting Started, Views, Habits, Collections & Tags, Keyboard Shortcuts, Settings). Use `kbd` elements for shortcuts.
- **Right Sidebar (TOC)**: `w-[200px]` sticky sidebar with "ON THIS PAGE" label and anchor links to sections. Add scroll spy (using `IntersectionObserver` or scroll listener) to highlight the active TOC item with a left border.
