import { Router, type Request, type Response, type NextFunction } from "express";
import { createApiToken, listApiTokens, revokeApiToken } from "../services/apiTokenService.js";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listApiTokens(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createApiToken(req.userId!, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeApiToken(req.userId!, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
