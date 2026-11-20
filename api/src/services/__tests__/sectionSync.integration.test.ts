import { expect, it } from "vitest";
import pool from "../../db/pool.js";
import { redisClient, redisPubClient } from "../../db/redis.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import type { SyncEvent } from "../syncService.js";
import { createSection, deleteSection, updateSection } from "../sectionService.js";

it("publishes committed section changes and records activity", async () => {
  const fixture = await createTestUserWithCollection();
  const { userId, collectionId } = fixture;
  const subscriber = redisClient.duplicate();
  const events: SyncEvent[] = [];
  try {
    await redisPubClient.connect();
    await subscriber.connect();
    await subscriber.subscribe("sync:collection-members", (message) => {
      const event = JSON.parse(message) as SyncEvent;
      if (event.entityType === "section" && event.collectionId === collectionId) events.push(event);
    });
    const section = await createSection(collectionId, userId, { name: "First draft" });
    await updateSection(section.id, userId, { name: "Final draft" });
    await deleteSection(section.id, userId);

    await expect.poll(() => events.map(({ eventType, entityId, collectionId: id }) => [eventType, entityId, id]))
      .toEqual(["created", "updated", "deleted"].map((type) => [type, section.id, collectionId]));

    expect(events.every((event) => event.payload === undefined)).toBe(true);

    const { rows } = await pool.query(
      "SELECT event_type FROM activity_events WHERE collection_id = $1 AND entity_id = $2 ORDER BY event_type",
      [collectionId, section.id],
    );
    expect(rows.map((row) => row.event_type)).toEqual(["section_created", "section_deleted", "section_updated"]);
  } finally {
    if (subscriber.isOpen) await subscriber.quit();
    if (redisPubClient.isOpen) await redisPubClient.quit();
    await fixture.cleanup();
  }
});
