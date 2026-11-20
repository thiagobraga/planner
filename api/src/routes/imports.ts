import { Router, type Request, type Response, type NextFunction } from "express";
import { applyMarkdownImport, previewMarkdownImport, undoMarkdownImport } from "../services/import/importService.js";
import { UUID_RE } from "../services/document/schema.js";
import { AppError } from "../utils/AppError.js";

const router: ReturnType<typeof Router> = Router();

router.post("/markdown/preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await previewMarkdownImport(req.userId!, req.body));
  } catch (err) {
    next(err);
  }
});

router.post("/markdown", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applyMarkdownImport(req.userId!, req.body);
    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) throw new AppError({ code: "NOT_FOUND", message: "Import not found", statusCode: 404 });
    res.json(await undoMarkdownImport(req.userId!, id));
  } catch (err) {
    next(err);
  }
});

export default router;
