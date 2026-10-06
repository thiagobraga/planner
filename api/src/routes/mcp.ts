import { Router, type Request, type Response, type NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server.js";

const router: ReturnType<typeof Router> = Router();

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  // Agents only. Keeping browsers off this route means it never has to reason
  // about CSRF, which token requests skip.
  if (req.authMethod !== "token") {
    res.status(403).json({
      error: { code: "TOKEN_REQUIRED", message: "The MCP endpoint requires an API token (Authorization: Bearer plnr_...)" },
    });
    return;
  }

  try {
    const server = buildMcpServer({ userId: req.userId!, scopes: req.tokenScopes ?? [], now: () => new Date() });
    // Stateless: no MCP sessions and no server-initiated stream, so each POST
    // is answered as a plain JSON response and nothing outlives the request.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    next(err);
  }
});

router.all("/", (_req: Request, res: Response) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for MCP requests" } });
});

export default router;
