declare namespace Express {
  interface Request {
    userId?: string;
    sessionId?: number;
    authMethod?: "session" | "token" | "oauth";
    tokenId?: string;
    tokenScopes?: import("./apiToken.js").ApiTokenScope[];
  }
}
