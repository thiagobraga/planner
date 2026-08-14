import type { Locator, Page } from '@playwright/test';

type Point = { x: number; y: number };

function centerOf(box: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Drag a card with real pointer events.
 *
 * dnd-kit needs a pointer-down plus a movement delta that clears the activation
 * distance, so this helper avoids locator.dragTo() and walks the pointer in
 * multiple steps after a short settle.
 */
export async function dragCard(page: Page, from: Locator, to: Locator): Promise<void> {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();

  if (!fromBox) {
    throw new Error('Cannot drag from a locator without a bounding box');
  }
  if (!toBox) {
    throw new Error('Cannot drag to a locator without a bounding box');
  }

  const start = centerOf(fromBox);
  const end = centerOf(toBox);
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
  };
  const distance = Math.hypot(delta.x, delta.y) || 1;
  const activationDistance = Math.max(12, distance / 5);
  const activationPoint: Point = {
    x: start.x + (delta.x / distance) * activationDistance,
    y: start.y + (delta.y / distance) * activationDistance,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(activationPoint.x, activationPoint.y);

  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      activationPoint.x + (end.x - activationPoint.x) * (step / steps),
      activationPoint.y + (end.y - activationPoint.y) * (step / steps),
    );
  }

  await page.mouse.up();
  await page.waitForTimeout(80);
}
