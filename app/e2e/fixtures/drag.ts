import type { Locator, Page } from '@playwright/test';

type Point = { x: number; y: number };

function centerOf(box: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Boards live in a 680px page column, so a far column can sit outside the
 * board's visible scroll area. Hold the pointer at that edge, as a person
 * would, until dnd-kit auto-scroll brings the target's center into view.
 */
async function revealByAutoScroll(page: Page, to: Locator, from: Point, end: Point): Promise<Point> {
  const visible = () => to.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const center = box.left + box.width / 2;
    let clip = { left: 0, right: window.innerWidth };
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX !== 'visible') {
        const rect = node.getBoundingClientRect();
        clip = { left: rect.left, right: rect.right };
        break;
      }
    }
    return { center, clip, y: box.top + box.height / 2 };
  });

  let state = await visible();
  if (state.center >= state.clip.left && state.center <= state.clip.right) return end;
  const edgeX = state.center > state.clip.right ? state.clip.right - 8 : state.clip.left + 8;
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(from.x + (edgeX - from.x) * (step / steps), from.y);
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(100);
    state = await visible();
    if (state.center >= state.clip.left + 24 && state.center <= state.clip.right - 24) break;
  }
  await page.mouse.move(Math.max(state.clip.left + 40, Math.min(state.center, state.clip.right - 40)), from.y);
  await page.waitForTimeout(100);
  state = await visible();
  return { x: state.center, y: state.y };
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

  const target = await revealByAutoScroll(page, to, activationPoint, end);
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      activationPoint.x + (target.x - activationPoint.x) * (step / steps),
      activationPoint.y + (target.y - activationPoint.y) * (step / steps),
    );
  }

  await page.mouse.up();
  await page.waitForTimeout(80);
}
