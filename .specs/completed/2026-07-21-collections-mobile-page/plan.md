# Collections Page for Mobile

## Summary
Add a top-level `/collections` page that matches the attached mockup: a paper-like mobile index screen with the title and subtitle at the top, a prominent add button, and a scrollable hierarchy of collections with colored dots, nested children, action menus, and chevrons into detail.

## Requirements
- The page should be mobile-first, with a compact but readable list layout.
- Each top-level collection row should show a colored dot, name, row actions, and a chevron into the detail page.
- Nested collections should be visibly indented under their parent, matching the tree structure in the mockup.
- The add button should live in the top-right of the page header and feel visually consistent with the app’s warm paper aesthetic.
- The sidebar should expose a `COLLECTIONS` entry point so the page is reachable from desktop and mobile navigation.
- Tapping a collection should navigate to `/collection/:id`.
- Reuse existing collection data, palette helpers, and tree logic instead of inventing a second model.

## Implementation
- Add a new page component for the collections index view.
- Add the `/collections` route in `app/src/App.tsx`.
- Add a sidebar entry or collection-section link in `app/src/components/Sidebar.tsx` that leads to the new page.
- Reuse `fetchCollections` and the existing tree-building helpers so the mobile page can render the same hierarchy as the sidebar.
- Keep the existing [app/src/pages/CollectionsPage.tsx](/p/projects/planner/app/src/pages/CollectionsPage.tsx) detail route intact and use it as the drill-in target.
- Preserve the left navigation shell shown in the image, but treat the collections page as the main content area rather than a sidebar clone.

## Risks
- A new index screen could drift from the sidebar tree if shared logic is not extracted.
- Row actions and chevrons can clutter small screens if spacing and touch targets are not tuned carefully.
- The mobile layout could become too dense if nested rows are rendered without strict indentation and truncation rules.

## Verification
- Add a route test for `/collections`.
- Add a navigation test that opens a collection detail page from the index.
- Add a render test that confirms parent and child collections both appear in the hierarchy.
- Confirm desktop collection detail behavior is unchanged.
- Validate the page on a narrow viewport against the attached mockup.
