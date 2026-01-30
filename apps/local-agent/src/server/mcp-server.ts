import type { MCPRequest, MCPResponse, AgentType } from '@whatsapp-agents/shared';
import type { FilesAgent } from '../agents/files/index.js';
import type { WebAgent } from '../agents/web/index.js';
import type { ProductivityAgent } from '../agents/productivity/index.js';
import type { CommsAgent } from '../agents/comms/index.js';

interface Agents {
  files: FilesAgent;
  web: WebAgent;
  productivity: ProductivityAgent;
  comms: CommsAgent;
}

export class MCPServer {
  private agents: Agents;

  constructor(agents: Agents) {
    this.agents = agents;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    console.log(`[MCP] Request: ${method} - ${params?.tool}`);

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: this.listTools(),
      };
    }

    if (method === 'tools/call') {
      const { tool, arguments: args } = params;
      const result = await this.executeTool(tool, args);
      return {
        jsonrpc: '2.0',
        id,
        ...result,
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unknown method: ${method}`,
      },
    };
  }

  listTools() {
    return {
      tools: [
        // Files Agent
        { name: 'files_search', description: 'Buscar archivos por nombre o contenido' },
        { name: 'files_read', description: 'Leer contenido de un archivo' },
        { name: 'files_create', description: 'Crear un nuevo archivo' },
        { name: 'files_list', description: 'Listar archivos en un directorio' },
        { name: 'files_organize', description: 'Organizar archivos por tipo/fecha' },

        // Web Agent
        { name: 'web_search', description: 'Buscar en Google' },
        { name: 'web_scrape', description: 'Extraer contenido de una página' },
        { name: 'web_screenshot', description: 'Capturar screenshot de una página' },
        { name: 'web_fill_form', description: 'Rellenar un formulario web' },
        { name: 'web_monitor', description: 'Monitorear cambios en una página' },

        // Productivity Agent
        { name: 'calendar_list_events', description: 'Ver eventos del calendario' },
        { name: 'calendar_create_event', description: 'Crear evento' },
        { name: 'notes_create', description: 'Crear nota' },
        { name: 'notes_search', description: 'Buscar notas' },
        { name: 'notes_read', description: 'Leer nota' },
        { name: 'reminder_create', description: 'Crear recordatorio' },
        { name: 'tasks_list', description: 'Listar tareas' },
        { name: 'tasks_create', description: 'Crear tarea' },
        { name: 'tasks_complete', description: 'Completar tarea' },

        // Comms Agent
        { name: 'email_send', description: 'Enviar email' },
        { name: 'email_list', description: 'Listar emails' },
        { name: 'email_read', description: 'Leer email' },
        { name: 'email_reply', description: 'Responder email' },
        { name: 'email_draft', description: 'Crear borrador' },
      ],
    };
  }

  private async executeTool(
    tool: string,
    args: Record<string, unknown>
  ): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
    try {
      const startTime = Date.now();

      // Determinar agente por prefijo de herramienta
      const [agentPrefix] = tool.split('_');
      let result: unknown;

      switch (agentPrefix) {
        case 'files':
          result = await this.agents.files.execute(tool, args);
          break;
        case 'web':
          result = await this.agents.web.execute(tool, args);
          break;
        case 'calendar':
        case 'notes':
        case 'reminder':
        case 'tasks':
          result = await this.agents.productivity.execute(tool, args);
          break;
        case 'email':
          result = await this.agents.comms.execute(tool, args);
          break;
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`[MCP] Tool ${tool} completed in ${executionTime}ms`);

      return { result };
    } catch (error) {
      console.error(`[MCP] Tool ${tool} error:`, error);
      return {
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Tool execution failed',
        },
      };
    }
  }
}
