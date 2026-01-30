import type { MCPServer } from './mcp-server.js';

const CLOUD_URL = process.env.CLOUD_BACKEND_URL || '';
const SECRET = process.env.LOCAL_AGENT_SECRET || '';
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '2') * 1000;

export async function startPolling(mcpServer: MCPServer) {
  console.log(`[Polling] Started, interval: ${POLLING_INTERVAL / 1000}s`);

  while (true) {
    try {
      // Obtener requests pendientes
      const response = await fetch(`${CLOUD_URL}/mcp/pending`, {
        headers: {
          'X-Agent-Secret': SECRET,
        },
      });

      if (!response.ok) {
        console.error(`[Polling] Error fetching pending: ${response.status}`);
        await sleep(POLLING_INTERVAL);
        continue;
      }

      const { requests } = await response.json() as { requests: any[] };

      if (requests.length > 0) {
        console.log(`[Polling] Processing ${requests.length} requests`);
      }

      // Procesar cada request
      for (const request of requests) {
        try {
          const result = await mcpServer.handleRequest({
            jsonrpc: '2.0',
            id: request.id,
            method: 'tools/call',
            params: {
              tool: request.tool,
              arguments: request.params,
            },
          });

          // Enviar respuesta al cloud
          await fetch(`${CLOUD_URL}/mcp/response`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Agent-Secret': SECRET,
            },
            body: JSON.stringify({
              requestId: request.id,
              result: result.result,
              error: result.error?.message,
            }),
          });

          console.log(`[Polling] Request ${request.id} processed`);
        } catch (error) {
          console.error(`[Polling] Error processing request ${request.id}:`, error);

          // Enviar error al cloud
          await fetch(`${CLOUD_URL}/mcp/response`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Agent-Secret': SECRET,
            },
            body: JSON.stringify({
              requestId: request.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          });
        }
      }
    } catch (error) {
      console.error('[Polling] Error:', error);
    }

    await sleep(POLLING_INTERVAL);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
