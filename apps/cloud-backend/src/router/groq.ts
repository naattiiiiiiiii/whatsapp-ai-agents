import Groq from 'groq-sdk';
import type { Env } from '../index';
import { AGENTS, type AgentType } from '@whatsapp-agents/shared';

export interface RoutingResult {
  requiresLocalAgent: boolean;
  agent?: AgentType;
  agentName?: string;
  agentEmoji?: string;
  tool?: string;
  params?: Record<string, unknown>;
  response: string;
}

const ROUTING_SYSTEM_PROMPT = `Eres un router inteligente para un sistema de agentes IA vía WhatsApp.

Tu trabajo es:
1. Analizar el mensaje del usuario
2. Decidir si necesita uno de los 4 agentes especializados
3. Si es así, extraer los parámetros necesarios para la herramienta

Los 4 agentes disponibles son:

📁 AGENTE ARCHIVOS (type: "files"):
- files_search: Buscar archivos por nombre/contenido
- files_read: Leer contenido de un archivo
- files_create: Crear nuevos documentos
- files_list: Listar archivos en directorio
- files_organize: Organizar archivos por tipo/fecha

🌐 AGENTE WEB (type: "web"):
- web_search: Búsquedas en Google
- web_scrape: Extraer contenido de páginas
- web_screenshot: Capturas de páginas
- web_fill_form: Rellenar formularios
- web_monitor: Monitorear cambios en páginas

📅 AGENTE PRODUCTIVIDAD (type: "productivity"):
- calendar_list_events: Ver eventos del calendario
- calendar_create_event: Crear eventos
- notes_create: Crear notas
- notes_search: Buscar notas
- notes_read: Leer una nota
- reminder_create: Crear recordatorios
- tasks_list: Listar tareas
- tasks_create: Crear tareas
- tasks_complete: Completar tareas

💬 AGENTE COMUNICACIÓN (type: "comms"):
- email_send: Enviar emails
- email_list: Listar emails
- email_read: Leer email completo
- email_reply: Responder emails
- email_draft: Crear borradores

REGLAS:
- Si el usuario hace una pregunta general o saluda, responde directamente sin usar agentes
- Si el usuario necesita una acción específica, identifica el agente y herramienta correctos
- Extrae todos los parámetros posibles del mensaje del usuario
- Si faltan parámetros requeridos, responde pidiendo esa información

RESPONDE EN JSON CON ESTE FORMATO:
{
  "needsAgent": boolean,
  "agent": "files" | "web" | "productivity" | "comms" | null,
  "tool": "nombre_herramienta" | null,
  "params": { ...parámetros extraídos },
  "directResponse": "respuesta si no necesita agente" | null,
  "missingParams": ["lista de parámetros que faltan"] | null
}`;

export async function routeMessage(
  env: Env,
  message: string,
  conversationContext: string[]
): Promise<RoutingResult> {
  const groq = new Groq({ apiKey: env.GROQ_API_KEY });

  const contextString = conversationContext.length > 0
    ? `\nContexto de conversación:\n${conversationContext.join('\n')}\n`
    : '';

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: ROUTING_SYSTEM_PROMPT },
        { role: 'user', content: `${contextString}\nMensaje actual: ${message}` }
      ],
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const routing = JSON.parse(responseText);

    if (!routing.needsAgent) {
      return {
        requiresLocalAgent: false,
        response: routing.directResponse || 'Hola, ¿en qué puedo ayudarte?'
      };
    }

    if (routing.missingParams && routing.missingParams.length > 0) {
      const agentDef = AGENTS.find(a => a.type === routing.agent);
      return {
        requiresLocalAgent: false,
        response: `${agentDef?.emoji || '🤖'} Necesito más información:\n${routing.missingParams.map((p: string) => `• ${p}`).join('\n')}`
      };
    }

    const agentDef = AGENTS.find(a => a.type === routing.agent);

    return {
      requiresLocalAgent: true,
      agent: routing.agent,
      agentName: agentDef?.name || 'Agente',
      agentEmoji: agentDef?.emoji || '🤖',
      tool: routing.tool,
      params: routing.params || {},
      response: ''
    };

  } catch (error) {
    console.error('Groq routing error:', error);
    return {
      requiresLocalAgent: false,
      response: '❌ Hubo un error procesando tu mensaje. Intenta de nuevo.'
    };
  }
}

export async function generateResponse(
  env: Env,
  context: string,
  userMessage: string
): Promise<string> {
  const groq = new Groq({ apiKey: env.GROQ_API_KEY });

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente amigable en WhatsApp. Responde de forma concisa y útil.
                    Usa emojis moderadamente. Mantén las respuestas cortas (máx 500 caracteres).`
        },
        { role: 'user', content: `${context}\n\nUsuario: ${userMessage}` }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'No pude generar una respuesta.';
  } catch (error) {
    console.error('Groq response error:', error);
    return 'Ocurrió un error. Intenta de nuevo.';
  }
}
