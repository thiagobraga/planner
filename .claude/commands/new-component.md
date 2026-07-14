Scaffold a new React component named $ARGUMENTS following the planner design system.

## Design System Rules (mandatory)

- Font: `font-family: var(--font-serif)` (Lora) - no sans-serif
- Background: `var(--color-paper)` (warm cream/beige)
- Accent: `var(--color-accent)` (brick-red) - use sparingly, ≤10% of visible area
- Elevation: flat - tint + 1px border only; NO box-shadow on cards
- Vertical rhythm: 24px baseline (`var(--spacing-6)`)
- No blue as primary color

## File to create: `app/src/components/$ARGUMENTS.tsx`

```tsx
import { type FC } from 'react';

interface $ARGUMENTSProps {
  // define props here
}

export const $ARGUMENTS: FC<$ARGUMENTSProps> = (
  {
    /* destructure props */
  },
) => {
  return <div className='$ARGUMENTS-root'>{/* content */}</div>;
};
```

## CSS (add to `app/src/index.css` or co-locate a `.css` file)

```css
.$ARGUMENTS-root {
  font-family: var(--font-serif);
  background: var(--color-paper);
  border: 1px solid var(--color-border);
  padding: var(--spacing-6); /* 24px vertical rhythm */
}
```

## Checklist before finishing

- [ ] No inline `font-family` using sans-serif
- [ ] No `box-shadow` on card elements
- [ ] Accent color used in ≤1-2 places (buttons, active states only)
- [ ] Props typed with a named interface (not inline)
- [ ] Renders correctly at 320px viewport width (mobile)
- [ ] If reusable primitive: add specimen to `app/src/pages/StyleguidePage.tsx`
