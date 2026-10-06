import { Router, type Request, type Response, type NextFunction } from "express";
import {
  decideAuthorizationRequest,
  disconnectApp,
  getAuthorizationRequest,
  listConnectedApps,
} from "../services/oauthService.js";
import { AppError } from "../utils/AppError.js";
import type { ConsentDecision } from "../types/oauth.js";

const router: ReturnType<typeof Router> = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS: readonly ConsentDecision[] = ["deny", "read", "write"];

function requireUuid(value: string): string {
  if (!UUID.test(value)) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }
  return value;
}

router.get("/requests/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getAuthorizationRequest(requireUuid(req.params.id as string)));
  } catch (err) {
    next(err);
  }
});

router.post("/requests/:id/decision", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const decision = req.body?.decision as ConsentDecision;
    if (!DECISIONS.includes(decision)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "decision must be deny, read or write", statusCode: 400 });
    }
    res.json(await decideAuthorizationRequest(req.userId!, requireUuid(req.params.id as string), decision));
  } catch (err) {
    next(err);
  }
});

router.get("/grants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listConnectedApps(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.delete("/grants/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await disconnectApp(req.userId!, requireUuid(req.params.id as string));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
