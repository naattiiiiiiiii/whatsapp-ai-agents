// Tipos compartidos entre cloud-backend y local-agent

// ==================== USUARIOS ====================
export interface User {
  id: string;
  phone: string;
  name: string;
  status: 'pending' | 'authorized' | 'revoked';
  authCode?: string;
  createdAt: number;
  authorizedAt?: number;
  authorizedBy?: string;
}

// ==================== AGENTES ====================
export type AgentType = 'files' | 'web' | 'productivity' | 'comms';

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    enum?: string[];
  }>;
}

export interface AgentDefinition {
  type: AgentType;
  name: string;
  emoji: string;
  description: string;
  tools: AgentTool[];
}

// ==================== MENSAJES ====================
export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'document';
  text?: string;
  mediaUrl?: string;
}

export interface AgentRequest {
  id: string;
  userId: string;
  phone: string;
  message: string;
  agent: AgentType;
  tool: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface AgentResponse {
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

// ==================== MCP PROTOCOL ====================
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: {
    tool: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// ==================== DEFINICIONES DE AGENTES ====================
export const AGENTS: AgentDefinition[] = [
  {
    type: 'files',
    name: 'Agente Archivos',
    emoji: '📁',
    description: 'Busca, lee, crea y organiza archivos en tu ordenador',
    tools: [
      {
        name: 'files_search',
        description: 'Buscar archivos por nombre o contenido',
        parameters: {
          query: { type: 'string', description: 'Texto a buscar', required: true },
          path: { type: 'string', description: 'Directorio donde buscar (por defecto: home)' },
          type: { type: 'string', description: 'Tipo de archivo', enum: ['pdf', 'doc', 'image', 'video', 'all'] }
        }
      },
      {
        name: 'files_read',
        description: 'Leer el contenido de un archivo',
        parameters: {
          path: { type: 'string', description: 'Ruta completa del archivo', required: true }
        }
      },
      {
        name: 'files_create',
        description: 'Crear un nuevo archivo con contenido',
        parameters: {
          path: { type: 'string', description: 'Ruta donde crear el archivo', required: true },
          content: { type: 'string', description: 'Contenido del archivo', required: true }
        }
      },
      {
        name: 'files_list',
        description: 'Listar archivos en un directorio',
        parameters: {
          path: { type: 'string', description: 'Directorio a listar', required: true },
          recursive: { type: 'boolean', description: 'Incluir subdirectorios' }
        }
      },
      {
        name: 'files_organize',
        description: 'Organizar archivos por tipo o fecha',
        parameters: {
          sourcePath: { type: 'string', description: 'Directorio origen', required: true },
          organizeBy: { type: 'string', description: 'Criterio de organización', enum: ['type', 'date', 'size'], required: true }
        }
      }
    ]
  },
  {
    type: 'web',
    name: 'Agente Web',
    emoji: '🌐',
    description: 'Busca en Google, extrae contenido de páginas y monitorea cambios',
    tools: [
      {
        name: 'web_search',
        description: 'Buscar en Google',
        parameters: {
          query: { type: 'string', description: 'Búsqueda a realizar', required: true },
          numResults: { type: 'number', description: 'Número de resultados (máx 10)' }
        }
      },
      {
        name: 'web_scrape',
        description: 'Extraer contenido de una página web',
        parameters: {
          url: { type: 'string', description: 'URL de la página', required: true },
          selector: { type: 'string', description: 'Selector CSS opcional' }
        }
      },
      {
        name: 'web_screenshot',
        description: 'Capturar screenshot de una página',
        parameters: {
          url: { type: 'string', description: 'URL de la página', required: true },
          fullPage: { type: 'boolean', description: 'Capturar página completa' }
        }
      },
      {
        name: 'web_fill_form',
        description: 'Rellenar un formulario web',
        parameters: {
          url: { type: 'string', description: 'URL del formulario', required: true },
          fields: { type: 'object', description: 'Campos a rellenar', required: true }
        }
      },
      {
        name: 'web_monitor',
        description: 'Monitorear cambios en una página',
        parameters: {
          url: { type: 'string', description: 'URL a monitorear', required: true },
          selector: { type: 'string', description: 'Selector CSS del elemento a monitorear' },
          interval: { type: 'number', description: 'Intervalo en minutos' }
        }
      }
    ]
  },
  {
    type: 'productivity',
    name: 'Agente Productividad',
    emoji: '📅',
    description: 'Gestiona calendario, notas, recordatorios y tareas',
    tools: [
      {
        name: 'calendar_list_events',
        description: 'Ver eventos del calendario',
        parameters: {
          startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD)' }
        }
      },
      {
        name: 'calendar_create_event',
        description: 'Crear evento en el calendario',
        parameters: {
          title: { type: 'string', description: 'Título del evento', required: true },
          startTime: { type: 'string', description: 'Fecha y hora inicio (ISO)', required: true },
          endTime: { type: 'string', description: 'Fecha y hora fin (ISO)', required: true },
          description: { type: 'string', description: 'Descripción del evento' }
        }
      },
      {
        name: 'notes_create',
        description: 'Crear una nota',
        parameters: {
          title: { type: 'string', description: 'Título de la nota', required: true },
          content: { type: 'string', description: 'Contenido de la nota', required: true },
          tags: { type: 'array', description: 'Etiquetas para la nota' }
        }
      },
      {
        name: 'notes_search',
        description: 'Buscar en las notas',
        parameters: {
          query: { type: 'string', description: 'Texto a buscar', required: true }
        }
      },
      {
        name: 'notes_read',
        description: 'Leer una nota específica',
        parameters: {
          noteId: { type: 'string', description: 'ID de la nota', required: true }
        }
      },
      {
        name: 'reminder_create',
        description: 'Crear un recordatorio',
        parameters: {
          message: { type: 'string', description: 'Mensaje del recordatorio', required: true },
          datetime: { type: 'string', description: 'Cuándo recordar (ISO)', required: true }
        }
      },
      {
        name: 'tasks_list',
        description: 'Listar tareas pendientes',
        parameters: {
          status: { type: 'string', description: 'Filtrar por estado', enum: ['pending', 'completed', 'all'] }
        }
      },
      {
        name: 'tasks_create',
        description: 'Crear una nueva tarea',
        parameters: {
          title: { type: 'string', description: 'Título de la tarea', required: true },
          dueDate: { type: 'string', description: 'Fecha límite (YYYY-MM-DD)' },
          priority: { type: 'string', description: 'Prioridad', enum: ['low', 'medium', 'high'] }
        }
      },
      {
        name: 'tasks_complete',
        description: 'Marcar tarea como completada',
        parameters: {
          taskId: { type: 'string', description: 'ID de la tarea', required: true }
        }
      }
    ]
  },
  {
    type: 'comms',
    name: 'Agente Comunicación',
    emoji: '💬',
    description: 'Envía y gestiona emails',
    tools: [
      {
        name: 'email_send',
        description: 'Enviar un email',
        parameters: {
          to: { type: 'string', description: 'Destinatario', required: true },
          subject: { type: 'string', description: 'Asunto', required: true },
          body: { type: 'string', description: 'Cuerpo del email', required: true },
          cc: { type: 'string', description: 'Copia a (CC)' }
        }
      },
      {
        name: 'email_list',
        description: 'Listar emails recibidos',
        parameters: {
          folder: { type: 'string', description: 'Carpeta', enum: ['inbox', 'sent', 'drafts'] },
          unreadOnly: { type: 'boolean', description: 'Solo no leídos' },
          limit: { type: 'number', description: 'Número máximo de emails' }
        }
      },
      {
        name: 'email_read',
        description: 'Leer un email completo',
        parameters: {
          emailId: { type: 'string', description: 'ID del email', required: true }
        }
      },
      {
        name: 'email_reply',
        description: 'Responder a un email',
        parameters: {
          emailId: { type: 'string', description: 'ID del email original', required: true },
          body: { type: 'string', description: 'Contenido de la respuesta', required: true }
        }
      },
      {
        name: 'email_draft',
        description: 'Crear borrador de email',
        parameters: {
          to: { type: 'string', description: 'Destinatario', required: true },
          subject: { type: 'string', description: 'Asunto', required: true },
          body: { type: 'string', description: 'Cuerpo del email', required: true }
        }
      }
    ]
  }
];

// ==================== UTILIDADES ====================
export function generateAuthCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatPhone(phone: string): string {
  // Normalizar número de teléfono (quitar espacios, guiones, etc.)
  return phone.replace(/[^0-9+]/g, '');
}

export function getAgentByType(type: AgentType): AgentDefinition | undefined {
  return AGENTS.find(a => a.type === type);
}

export function getToolByName(toolName: string): { agent: AgentDefinition; tool: AgentTool } | undefined {
  for (const agent of AGENTS) {
    const tool = agent.tools.find(t => t.name === toolName);
    if (tool) {
      return { agent, tool };
    }
  }
  return undefined;
}
