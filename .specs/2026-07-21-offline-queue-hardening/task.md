# Offline Queue Hardening

- [ ] Inspect the offline queue DB upgrade and query path
- [ ] Add a safe fallback when `ownerUserId` index lookup fails
- [ ] Preserve FIFO ordering after fallback filtering
- [ ] Strengthen schema repair or upgrade behavior
- [ ] Add a regression test for the missing index crash
- [ ] Add a regression test for ordering after fallback
- [ ] Verify the replay path no longer throws

