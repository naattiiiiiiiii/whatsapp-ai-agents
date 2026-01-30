import type { Env } from '../index';
import type { MCPRequest, MCPResponse, AgentRequest } from '@whatsapp-agents/shared';

export class MCPClient {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async sendRequest(request: AgentRequest): Promise<MCPResponse> {
    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: request.id,
      method: 'tools/call',
      params: {
        tool: request.tool,
        arguments: request.params,
      },
    };

    try {
      const response = await fetch(`${this.env.LOCAL_AGENT_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Secret': this.env.LOCAL_AGENT_SECRET,
        },
        body: JSON.stringify(mcpRequest),
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MCP Client error:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.env.LOCAL_AGENT_URL}/health`, {
        method: 'GET',
        headers: {
          'X-Agent-Secret': this.env.LOCAL_AGENT_SECRET,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
