import { Router, type Request, type Response, type NextFunction } from "express";
import { parseDuePhrase } from "../services/dateService.js";
import { getUserTimezone } from "../services/viewService.js";
import { AppError } from "../utils/AppError.js";

const router: ReturnType<typeof Router> = Router();

const MAX_PHRASE = 200;

router.get("/parse", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q || q.length > MAX_PHRASE) {
      throw new AppError({ code: "VALIDATION_ERROR", message: `q must be 1-${MAX_PHRASE} characters`, statusCode: 400 });
    }
    const locale = req.query.locale === "pt-BR" ? "pt-BR" : undefined;
    const timeZone = await getUserTimezone(req.userId!);

    let parsed;
    try {
      parsed = parseDuePhrase(q, timeZone, new Date(), locale);
    } catch {
      throw new AppError({ code: "DATE_NOT_RECOGNIZED", message: `Could not understand "${q}"`, statusCode: 404 });
    }
    res.json({ date: parsed.dueDate, time: parsed.dueTime, recurrence: parsed.recurrenceRule });
  } catch (err) {
    next(err);
  }
});

export default router;
