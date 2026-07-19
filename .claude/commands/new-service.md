Scaffold a new API service named $ARGUMENTS following project conventions.

Use $ARGUMENTS as the service name (e.g. "reminder" → reminderService).

## Files to create

### 1. Service - `api/src/services/$ARGUMENTSService.ts`

Follow this pattern (example uses "reminder" as the name):

```typescript
import { pool } from '../db/pool';
import { AppError } from '../utils/AppError';
import { publishEvent } from './syncService';

export async function getAll(userId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return rows;
}

export async function create(userId: string, data: { taskId: string; remindAt: Date }) {
  const { rows } = await pool.query(
    'INSERT INTO reminders (user_id, task_id, remind_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, data.taskId, data.remindAt],
  );
  await publishEvent({ entityType: 'reminder', eventType: 'created', entityId: rows[0].id, userId, payload: rows[0] });
  return rows[0];
}
```

### 2. Route - `api/src/routes/$ARGUMENTSRoutes.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as service from '../services/$ARGUMENTSService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const items = await service.getAll(req.user!.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await service.create(req.user!.id, req.body);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
```

### 3. Register in `api/src/routes/index.ts`

Add these two lines in the route aggregation block:

```typescript
import $ARGUMENTSRoutes from './$ARGUMENTSRoutes';
router.use('/$ARGUMENTS_PLURAL', $ARGUMENTSRoutes);
```

### 4. Unit test - `api/src/services/__tests__/$ARGUMENTSService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../db/pool';
import * as service from '../$ARGUMENTSService';

vi.mock('../../db/pool', () => ({ pool: { query: vi.fn() } }));
vi.mock('../syncService', () => ({ publishEvent: vi.fn() }));

const mockPool = pool as { query: ReturnType<typeof vi.fn> };

describe('$ARGUMENTSService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAll returns rows for user', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });
    const result = await service.getAll('user-1');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('create inserts and publishes event', async () => {
    const { publishEvent } = await import('../syncService');
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'r-1' }] });
    const result = await service.create('user-1', { taskId: 't-1', remindAt: new Date() });
    expect(result.id).toBe('r-1');
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringContaining('created') }),
    );
  });
});
```

After generating the files, verify with:

```bash
docker compose exec api npm exec vitest run src/services/__tests__/$ARGUMENTSService.test.ts
```
