import 'dotenv/config';
import express from 'express';
import { MCPServer } from './server/mcp-server.js';
import { startPolling } from './server/polling.js';
import { FilesAgent } from './agents/files/index.js';
import { WebAgent } from './agents/web/index.js';
import { ProductivityAgent } from './agents/productivity/index.js';
import { CommsAgent } from './agents/comms/index.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SECRET = process.env.LOCAL_AGENT_SECRET || '';

// Inicializar agentes
const agents = {
  files: new FilesAgent(),
  web: new WebAgent(),
  productivity: new ProductivityAgent(),
  comms: new CommsAgent(),
};

// Servidor MCP
const mcpServer = new MCPServer(agents);

// Middleware de autenticación
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers['x-agent-secret'];
  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: Object.keys(agents),
    uptime: process.uptime(),
  });
});

// Endpoint MCP (para llamadas directas via tunnel)
app.post('/mcp', authenticate, async (req, res) => {
  try {
    const result = await mcpServer.handleRequest(req.body);
    res.json(result);
  } catch (error) {
    console.error('MCP error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    });
  }
});

// Listar herramientas disponibles
app.get('/tools', authenticate, (req, res) => {
  res.json(mcpServer.listTools());
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🤖 WhatsApp AI Agents - Local Agent              ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║                                                           ║
║  Agents loaded:                                           ║
║    📁 Files Agent                                         ║
║    🌐 Web Agent                                           ║
║    📅 Productivity Agent                                  ║
║    💬 Communications Agent                                ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /health  - Health check                           ║
║    POST /mcp     - MCP requests                           ║
║    GET  /tools   - List available tools                   ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Iniciar polling al cloud backend
  if (process.env.CLOUD_BACKEND_URL) {
    console.log('Starting polling to cloud backend...');
    startPolling(mcpServer);
  }
});

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await agents.web.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await agents.web.close();
  process.exit(0);
});
