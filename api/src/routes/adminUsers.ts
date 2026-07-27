import { Router, type Request, type Response, type NextFunction } from "express";

import {
  listUsers,
  disableUser,
  enableUser,
  revokeSessions,
} from "../services/adminUserService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, cursor, limit } = req.query;
    res.json(
      await listUsers({
        search: typeof search === "string" ? search : undefined,
        cursor: typeof cursor === "string" ? cursor : undefined,
        limit: typeof limit === "string" ? Number(limit) || undefined : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/:id/disable", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await disableUser(req.userId!, req.params.id as string));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/enable", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await enableUser(req.userId!, req.params.id as string));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/revoke-sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await revokeSessions(req.userId!, req.params.id as string));
  } catch (err) {
    next(err);
  }
});

export default router;
