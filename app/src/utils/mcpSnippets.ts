export const TOKEN_PLACEHOLDER = 'plnr_your_token';

export function mcpUrl(origin: string): string {
  return `${origin}/api/v1/mcp`;
}

export function claudeCodeCommand(url: string, token: string): string {
  return `claude mcp add --transport http planner ${url} --header "Authorization: Bearer ${token}"`;
}

/** The `mcpServers` shape Claude Desktop, Cursor and VS Code all read. */
export function mcpJsonConfig(url: string, token: string): string {
  return JSON.stringify(
    { mcpServers: { planner: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
}
