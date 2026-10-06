import { describe, it, expect } from 'vitest';
import { claudeCodeCommand, mcpJsonConfig, mcpUrl } from '../mcpSnippets';

describe('MCP connection snippets', () => {
  const url = mcpUrl('https://planner.example.com');

  it('builds the endpoint from the app origin', () => {
    expect(url).toBe('https://planner.example.com/api/v1/mcp');
  });

  it('builds a Claude Code command with the bearer header', () => {
    expect(claudeCodeCommand(url, 'plnr_abc')).toBe(
      'claude mcp add --transport http planner https://planner.example.com/api/v1/mcp --header "Authorization: Bearer plnr_abc"',
    );
  });

  it('builds a JSON config clients can paste as-is', () => {
    expect(JSON.parse(mcpJsonConfig(url, 'plnr_abc'))).toEqual({
      mcpServers: {
        planner: {
          type: 'http',
          url: 'https://planner.example.com/api/v1/mcp',
          headers: { Authorization: 'Bearer plnr_abc' },
        },
      },
    });
  });
});
