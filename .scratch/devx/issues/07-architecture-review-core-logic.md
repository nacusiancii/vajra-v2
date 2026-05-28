Status: needs-triage

## DevX: Architecture review for core logic

Review the domain/repository/IPC architecture established in the Customer & Product Master implementation before it becomes the template for all future entities:

- Is `src/domain/` → `src/main/repositories/` → `src/main/ipc.ts` the right layering?
- Should repositories own transaction boundaries, or should there be a service layer?
- Is the `ReferenceChecker` interface the right abstraction for delete guards?
- How should cross-entity operations work (e.g., Opening Stock references Products)?
- Error handling: repositories currently throw on constraint violations — should they return Result types?
- Is the IPC handler registration in a single `ipc.ts` file sustainable, or should handlers be co-located with their feature?
