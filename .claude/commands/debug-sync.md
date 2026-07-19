Debug a real-time sync issue: $ARGUMENTS

Work through this checklist systematically.

## 1. Identify the mutation

Find the API endpoint that should trigger the sync event.

- Route: `api/src/routes/`
- Service: `api/src/services/`
- Check: does the service call `publishEvent()` from `api/src/services/syncService.ts`?

```bash
grep -n "publishEvent" api/src/services/*.ts
```

## 2. Check publishEvent payload

Open `api/src/services/syncService.ts`.

- Verify `type` field matches what frontend expects
- Verify `userId` is set (for `user:{userId}` room broadcast)
- Verify `collectionId` is set if collaborators need the event (for `collection:{collectionId}` room)

## 3. Check Redis pub/sub

Ensure Redis is running and the adapter is connected:

```bash
docker-compose ps redis
curl -s http://localhost:4000/api/v1/health | jq .redis
```

## 4. Check frontend subscriber

Open `app/src/hooks/useSync.ts`.

- Find the handler for the event `type` from step 2
- Verify it invalidates the correct React Query cache key OR updates the correct Zustand store
- Does it run? Add a `console.log` temporarily to confirm.

## 5. Check Socket.IO room membership

The socket must be in the right room. Check `api/src/index.ts`:

```bash
grep -n "socket.join" api/src/index.ts
```

Verify user joins `user:{userId}` on connect.

## 6. Check auth on socket connection

`api/src/index.ts` validates JWT on Socket.IO connect. Stale/missing token = socket never joins rooms.
Check `app/src/utils/socket.ts` - token must be in `socket.auth.token`, sourced from `localStorage.getItem('planner_token')`.

## 7. Reproduce with curl

Test the mutation directly:

```bash
# Login and capture token
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' | jq -r .token)

# Trigger mutation
curl -s -X POST http://localhost:4000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"sync test","projectId":null}'
```

Watch browser console - the sync event should arrive within ~100ms.

## Report format

- Root cause (which step failed)
- Fix with exact file:line
- Whether issue is backend (publishEvent missing/wrong) or frontend (handler missing/wrong cache key)
