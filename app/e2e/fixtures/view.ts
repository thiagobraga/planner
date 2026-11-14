import { expect, type Page } from '@playwright/test';

interface ViewChoice {
  layout?: 'List' | 'Columns';
  style?: 'Notebook' | 'Cards';
  /** A preset name (Today, This week, Month...) or a pill label (1 day, 3 days, 1 week...). */
  range?: string;
}

/** Picks layout, style and range through the View menu on the title row, then closes it. */
export async function chooseView(page: Page, { layout, style, range }: ViewChoice): Promise<void> {
  // On phones the toolbar lives in the bar above the navbar, so look for the one trigger anywhere.
  const trigger = page.getByRole('button', { name: 'View', exact: true });
  await trigger.click();
  const menu = page.getByRole('menu');
  if (layout) await menu.getByRole('menuitemradio', { name: new RegExp(`^${layout}`) }).click();
  if (style) await menu.getByRole('radio', { name: style }).click();
  if (range) {
    const preset = menu.getByRole('menuitemradio', { name: new RegExp(`^${range}`) });
    await (await preset.count() ? preset : menu.getByRole('button', { name: range, exact: true })).click();
  }
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
}

/** Opens the planner menu's theme swatches and picks one. */
export async function chooseTheme(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole('button', { name: 'Planner menu', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name }).click();
}
