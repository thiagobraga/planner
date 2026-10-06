import { Router, type Request, type Response, type NextFunction } from "express";
import { createPersonalToken, listPersonalTokens, revokePersonalToken } from "../services/apiTokenService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listPersonalTokens(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createPersonalToken(req.userId!, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokePersonalToken(req.userId!, req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
