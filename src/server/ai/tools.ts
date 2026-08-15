import { dbRepository } from '../db/database.js';

export interface ExecutableTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * All OpenAI Tool Definitions for FRIDAY Executive AI Brain
 */
export const FRIDAY_TOOLS: ExecutableTool[] = [
  // 1. Calendar Tools
  {
    type: 'function',
    function: {
      name: 'calendar_list_events',
      description: 'List upcoming calendar events, meetings, and briefings. Can filter by date such as "Today", "Tomorrow", or YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date to filter events (e.g. "Today", "Tomorrow", "2026-08-15")' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_schedule_event',
      description: 'Schedule a new calendar event, meeting, or executive session.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title or summary of the event (e.g. "Board Review", "Lunch with Pepper")' },
          startTime: { type: 'string', description: 'Start time (e.g. "02:00 PM", "10:30 AM")' },
          endTime: { type: 'string', description: 'End time (e.g. "03:00 PM")' },
          date: { type: 'string', description: 'Date for the event (e.g. "Today", "Tomorrow", or YYYY-MM-DD)' },
          location: { type: 'string', description: 'Meeting location or video link' },
          attendees: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of attendee names or emails'
          }
        },
        required: ['title', 'startTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_delete_event',
      description: 'Delete or cancel an existing calendar event by title or ID.',
      parameters: {
        type: 'object',
        properties: {
          titleOrId: { type: 'string', description: 'The title or ID of the event to remove' }
        },
        required: ['titleOrId']
      }
    }
  },

  // 2. Email & Gmail Tools
  {
    type: 'function',
    function: {
      name: 'gmail_list_emails',
      description: 'List recent inbound emails, with optional filter for unread or urgent messages.',
      parameters: {
        type: 'object',
        properties: {
          unreadOnly: { type: 'boolean', description: 'If true, only returns unread emails' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gmail_draft_email',
      description: 'Draft a new outbound email to a recipient.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address or contact name' },
          subject: { type: 'string', description: 'Subject line of the email' },
          body: { type: 'string', description: 'Content / body of the email draft' }
        },
        required: ['to', 'subject', 'body']
      }
    }
  },

  // 3. Tasks & Action Items
  {
    type: 'function',
    function: {
      name: 'tasks_list_tasks',
      description: 'List executive tasks and action items filtered by status (pending or completed).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'completed'], description: 'Task status filter' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tasks_create_task',
      description: 'Create a new executive action item or task with optional due date and priority.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task description' },
          dueDate: { type: 'string', description: 'Due date / time (e.g. "Today 5 PM", "Tomorrow")' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tasks_complete_task',
      description: 'Mark a task as completed.',
      parameters: {
        type: 'object',
        properties: {
          titleOrId: { type: 'string', description: 'Title or ID of the task to complete' }
        },
        required: ['titleOrId']
      }
    }
  },

  // 4. Contacts
  {
    type: 'function',
    function: {
      name: 'contacts_search',
      description: 'Search executive contacts by name, email, company, or role.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, email, or role to search for' }
        },
        required: ['query']
      }
    }
  },

  // 5. Timers & Reminders
  {
    type: 'function',
    function: {
      name: 'timers_set_timer',
      description: 'Set a countdown timer with duration in seconds.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Label for the timer (e.g. "Tea", "Focus sprint")' },
          durationSeconds: { type: 'number', description: 'Timer length in seconds (e.g. 300 for 5 minutes)' }
        },
        required: ['durationSeconds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reminders_set_reminder',
      description: 'Set a reminder for a specific task and time.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'What to remind the user about' },
          dueTime: { type: 'string', description: 'When to remind (e.g. "In 20 minutes", "5:00 PM")' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['task', 'dueTime']
      }
    }
  },

  // 6. Long-term Memory Facts
  {
    type: 'function',
    function: {
      name: 'memory_save_fact',
      description: 'Store a persistent long-term fact, user preference, or key piece of information about the user or executive workflows.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Unique identifier or descriptor for the fact (e.g. "favorite_coffee", "preferred_flight_class")' },
          value: { type: 'string', description: 'The fact or preference description' },
          category: { type: 'string', description: 'Category (e.g. "preference", "family", "business", "security")' }
        },
        required: ['key', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_recall_facts',
      description: 'Retrieve long-term memory facts and stored executive preferences.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of facts to retrieve' }
        }
      }
    }
  }
];

/**
 * Execute an OpenAI Tool Call against the SQLite Repository
 */
export async function executeToolCall(toolName: string, args: any): Promise<{ result: any; intent: string; actionData: any }> {
  try {
    switch (toolName) {
      case 'calendar_list_events': {
        const events = dbRepository.listCalendarEvents(args.date);
        return {
          result: events,
          intent: 'list_events',
          actionData: { events, date: args.date || 'upcoming' }
        };
      }

      case 'calendar_schedule_event': {
        const created = dbRepository.createCalendarEvent(args);
        return {
          result: created,
          intent: 'schedule_event',
          actionData: created
        };
      }

      case 'calendar_delete_event': {
        const res = dbRepository.deleteCalendarEvent(args.titleOrId);
        return {
          result: res,
          intent: 'delete_event',
          actionData: { query: args.titleOrId, ...res }
        };
      }

      case 'gmail_list_emails': {
        const emails = dbRepository.listEmails(args.unreadOnly);
        return {
          result: emails,
          intent: 'summarize_emails',
          actionData: { emails, unreadOnly: !!args.unreadOnly }
        };
      }

      case 'gmail_draft_email': {
        const draft = dbRepository.createDraftEmail(args.to, args.subject, args.body);
        return {
          result: draft,
          intent: 'draft_email',
          actionData: draft
        };
      }

      case 'tasks_list_tasks': {
        const tasks = dbRepository.listTasks(args.status || 'pending');
        return {
          result: tasks,
          intent: 'list_tasks',
          actionData: { tasks, status: args.status || 'pending' }
        };
      }

      case 'tasks_create_task': {
        const task = dbRepository.createTask(args.title, args.dueDate, args.priority);
        return {
          result: task,
          intent: 'create_task',
          actionData: task
        };
      }

      case 'tasks_complete_task': {
        const res = dbRepository.completeTask(args.titleOrId);
        return {
          result: res,
          intent: 'complete_task',
          actionData: { task: args.titleOrId, ...res }
        };
      }

      case 'contacts_search': {
        const contacts = dbRepository.searchContacts(args.query);
        return {
          result: contacts,
          intent: 'search_contacts',
          actionData: { query: args.query, contacts }
        };
      }

      case 'timers_set_timer': {
        const timer = dbRepository.setTimer(args.label, args.durationSeconds);
        return {
          result: timer,
          intent: 'set_timer',
          actionData: timer
        };
      }

      case 'reminders_set_reminder': {
        const reminder = dbRepository.setReminder(args.task, args.dueTime, args.priority);
        return {
          result: reminder,
          intent: 'set_reminder',
          actionData: reminder
        };
      }

      case 'memory_save_fact': {
        const fact = dbRepository.saveMemoryFact(args.key, args.value, args.category);
        return {
          result: fact,
          intent: 'memory_saved',
          actionData: fact
        };
      }

      case 'memory_recall_facts': {
        const facts = dbRepository.getMemoryFacts(args.limit || 15);
        return {
          result: facts,
          intent: 'memory_recalled',
          actionData: { facts }
        };
      }

      default:
        return {
          result: { error: `Tool ${toolName} not recognized` },
          intent: 'unknown',
          actionData: {}
        };
    }
  } catch (err: any) {
    console.error(`Error executing tool ${toolName}:`, err);
    return {
      result: { error: err.message || 'Execution error' },
      intent: 'error',
      actionData: { error: err.message }
    };
  }
}
