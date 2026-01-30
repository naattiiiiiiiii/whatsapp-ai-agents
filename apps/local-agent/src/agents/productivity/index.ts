import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '', '.whatsapp-agents');

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface Task {
  id: string;
  title: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  createdAt: number;
  completedAt?: number;
}

interface Reminder {
  id: string;
  message: string;
  remindAt: number;
  sent: boolean;
  createdAt: number;
}

export class ProductivityAgent {
  private notesDir: string;
  private tasksFile: string;
  private remindersFile: string;

  constructor() {
    this.notesDir = path.join(DATA_DIR, 'notes');
    this.tasksFile = path.join(DATA_DIR, 'tasks.json');
    this.remindersFile = path.join(DATA_DIR, 'reminders.json');
    this.ensureDataDir();
  }

  private async ensureDataDir() {
    await fs.mkdir(this.notesDir, { recursive: true }).catch(() => {});
  }

  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    await this.ensureDataDir();

    switch (tool) {
      // Calendar
      case 'calendar_list_events':
        return this.listEvents(args.startDate as string, args.endDate as string);
      case 'calendar_create_event':
        return this.createEvent(
          args.title as string,
          args.startTime as string,
          args.endTime as string,
          args.description as string
        );

      // Notes
      case 'notes_create':
        return this.createNote(args.title as string, args.content as string, args.tags as string[]);
      case 'notes_search':
        return this.searchNotes(args.query as string);
      case 'notes_read':
        return this.readNote(args.noteId as string);

      // Reminders
      case 'reminder_create':
        return this.createReminder(args.message as string, args.datetime as string);

      // Tasks
      case 'tasks_list':
        return this.listTasks(args.status as string);
      case 'tasks_create':
        return this.createTask(args.title as string, args.dueDate as string, args.priority as string);
      case 'tasks_complete':
        return this.completeTask(args.taskId as string);

      default:
        throw new Error(`Unknown productivity tool: ${tool}`);
    }
  }

  // ==================== CALENDAR ====================
  // Nota: Para integración real con Google Calendar, usar googleapis
  // Esta es una implementación local simplificada

  private async listEvents(startDate?: string, endDate?: string): Promise<object> {
    const eventsFile = path.join(DATA_DIR, 'events.json');
    let events: any[] = [];

    try {
      const data = await fs.readFile(eventsFile, 'utf-8');
      events = JSON.parse(data);
    } catch {
      events = [];
    }

    // Filtrar por fechas
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;

      events = events.filter(e => {
        const eventTime = new Date(e.startTime).getTime();
        return eventTime >= start && eventTime <= end;
      });
    }

    return {
      events: events.slice(0, 10),
      total: events.length,
    };
  }

  private async createEvent(
    title: string,
    startTime: string,
    endTime: string,
    description?: string
  ): Promise<object> {
    const eventsFile = path.join(DATA_DIR, 'events.json');
    let events: any[] = [];

    try {
      const data = await fs.readFile(eventsFile, 'utf-8');
      events = JSON.parse(data);
    } catch {
      events = [];
    }

    const event = {
      id: crypto.randomUUID(),
      title,
      startTime,
      endTime,
      description: description || '',
      createdAt: Date.now(),
    };

    events.push(event);
    await fs.writeFile(eventsFile, JSON.stringify(events, null, 2));

    return {
      created: true,
      event,
    };
  }

  // ==================== NOTES ====================

  private async createNote(title: string, content: string, tags?: string[]): Promise<object> {
    const id = crypto.randomUUID();
    const note: Note = {
      id,
      title,
      content,
      tags: tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const filePath = path.join(this.notesDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(note, null, 2));

    return {
      created: true,
      note: {
        id: note.id,
        title: note.title,
        tags: note.tags,
      },
    };
  }

  private async searchNotes(query: string): Promise<object> {
    const files = await fs.readdir(this.notesDir).catch(() => []);
    const results: Note[] = [];
    const queryLower = query.toLowerCase();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.notesDir, file);
      const data = await fs.readFile(filePath, 'utf-8');
      const note: Note = JSON.parse(data);

      if (
        note.title.toLowerCase().includes(queryLower) ||
        note.content.toLowerCase().includes(queryLower) ||
        note.tags.some(t => t.toLowerCase().includes(queryLower))
      ) {
        results.push(note);
      }
    }

    return {
      query,
      found: results.length,
      notes: results.map(n => ({
        id: n.id,
        title: n.title,
        preview: n.content.substring(0, 100),
        tags: n.tags,
        updatedAt: n.updatedAt,
      })),
    };
  }

  private async readNote(noteId: string): Promise<object> {
    const filePath = path.join(this.notesDir, `${noteId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const note: Note = JSON.parse(data);
      return { note };
    } catch {
      throw new Error(`Note not found: ${noteId}`);
    }
  }

  // ==================== REMINDERS ====================

  private async createReminder(message: string, datetime: string): Promise<object> {
    let reminders: Reminder[] = [];

    try {
      const data = await fs.readFile(this.remindersFile, 'utf-8');
      reminders = JSON.parse(data);
    } catch {
      reminders = [];
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      message,
      remindAt: new Date(datetime).getTime(),
      sent: false,
      createdAt: Date.now(),
    };

    reminders.push(reminder);
    await fs.writeFile(this.remindersFile, JSON.stringify(reminders, null, 2));

    return {
      created: true,
      reminder: {
        id: reminder.id,
        message: reminder.message,
        remindAt: new Date(reminder.remindAt).toISOString(),
      },
    };
  }

  // ==================== TASKS ====================

  private async getTasks(): Promise<Task[]> {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async saveTasks(tasks: Task[]): Promise<void> {
    await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
  }

  private async listTasks(status?: string): Promise<object> {
    let tasks = await this.getTasks();

    if (status && status !== 'all') {
      tasks = tasks.filter(t => t.status === status);
    }

    // Ordenar por prioridad y fecha
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return {
      tasks: tasks.slice(0, 20),
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };
  }

  private async createTask(title: string, dueDate?: string, priority?: string): Promise<object> {
    const tasks = await this.getTasks();

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      dueDate,
      priority: (priority as Task['priority']) || 'medium',
      status: 'pending',
      createdAt: Date.now(),
    };

    tasks.push(task);
    await this.saveTasks(tasks);

    return {
      created: true,
      task,
    };
  }

  private async completeTask(taskId: string): Promise<object> {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = 'completed';
    task.completedAt = Date.now();

    await this.saveTasks(tasks);

    return {
      completed: true,
      task,
    };
  }
}
