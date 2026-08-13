# Offline Queue Hardening

- [x] Inspect the offline queue DB upgrade and query path
- [x] Add a safe fallback when `ownerUserId` index lookup fails
- [x] Preserve FIFO ordering after fallback filtering
- [x] Strengthen schema repair or upgrade behavior
- [x] Add a regression test for the missing index crash
- [x] Add a regression test for ordering after fallback
- [x] Verify the replay path no longer throws

