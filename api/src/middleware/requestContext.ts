import { AsyncLocalStorage } from "async_hooks";
import type { Request, Response, NextFunction } from "express";
import type { RequestActor } from "../types/activity.js";

interface RequestContext {
  /**
   * The socket that made this request, as the client reported it.
   *
   * Carried through to every event the request publishes so the session that
   * caused a change can recognise - and ignore - its own echo.
   */
  sourceId?: string;
  /** Set by authMiddleware once a token is accepted; absent for browser sessions. */
  actor?: RequestActor;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Bind the calling socket to the request, for the whole of its handling.
 *
 * Async-local rather than threaded through every service signature: a sync
 * event is published deep inside the service layer, and passing an id that only
 * the sync layer reads through fifteen intermediate call sites would put it in
 * the way of everything that does not care about it.
 */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  const sourceId = req.headers["x-socket-id"];
  storage.run({ sourceId: typeof sourceId === "string" ? sourceId : undefined }, next);
}

/** The socket behind the request being handled, if it named itself. */
export function currentSourceId(): string | undefined {
  return storage.getStore()?.sourceId;
}

/**
 * Record who is acting for the rest of this request. The store is created
 * before authentication runs, so the actor is written into it afterwards.
 */
export function setActor(actor: RequestActor): void {
  const store = storage.getStore();
  if (store) store.actor = actor;
}

export function currentActor(): RequestActor | undefined {
  return storage.getStore()?.actor;
}
