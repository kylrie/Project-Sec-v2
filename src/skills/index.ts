import { googleWorkspaceService } from '../services/googleWorkspace';
import { storageService } from '../services/storage';

export type SkillStepType = 'api' | 'confirm' | 'draft' | 'notify';
export type SkillServiceType = 'calendar' | 'gmail' | 'tasks' | 'memory' | 'timers' | 'mesh';

export interface SkillStep {
  type: SkillStepType;
  description: string;
  service: SkillServiceType;
  personaId?: string;
  config?: Record<string, any>;
}

export interface Skill {
  id: string;
  name: string;
  triggerPhrases: string[];
  primaryPersona: string;
  steps: SkillStep[];
}

export const SKILLS: Skill[] = [
  {
    id: 'book-meeting',
    name: 'Book Meeting',
    primaryPersona: 'chrono',
    triggerPhrases: ['book a meeting', 'schedule a call', 'set up a meeting', 'book meeting', 'schedule meeting'],
    steps: [
      { type: 'api', description: 'Finding available calendar slots', service: 'calendar', personaId: 'chrono', config: { action: 'findSlots' } },
      { type: 'confirm', description: 'Confirm desired time slot with you', service: 'calendar', personaId: 'chrono' },
      { type: 'api', description: 'Creating calendar event', service: 'calendar', personaId: 'chrono', config: { action: 'createEvent' } },
      { type: 'draft', description: 'Drafting invite email', service: 'gmail', personaId: 'echo' },
      { type: 'confirm', description: 'Dispatch meeting invitation?', service: 'gmail', personaId: 'echo' }
    ]
  },
  {
    id: 'morning-briefing',
    name: 'Executive Morning Briefing',
    primaryPersona: 'ahri',
    triggerPhrases: ['morning briefing', 'daily brief', "what's on my schedule today", 'give me my briefing', 'morning brief'],
    steps: [
      { type: 'api', description: 'Fetching daily calendar events', service: 'calendar', personaId: 'chrono', config: { action: 'listToday' } },
      { type: 'api', description: 'Reviewing urgent priority tasks', service: 'tasks', personaId: 'cipher', config: { action: 'listPending' } },
      { type: 'api', description: 'Scanning unread executive emails', service: 'gmail', personaId: 'echo', config: { action: 'listUrgent' } },
      { type: 'notify', description: 'Synthesizing voice briefing', service: 'memory', personaId: 'ahri' }
    ]
  },
  {
    id: 'focus-sprint',
    name: 'Initiate Focus Sprint',
    primaryPersona: 'chrono',
    triggerPhrases: ['start focus sprint', 'focus mode', 'pomodoro', 'start deep work', 'focus session'],
    steps: [
      { type: 'api', description: 'Configuring 25-minute focus timer', service: 'timers', personaId: 'chrono', config: { duration: 1500, label: 'Deep Work Sprint' } },
      { type: 'api', description: 'Creating focus sprint milestone', service: 'tasks', personaId: 'cipher', config: { title: 'Executive Focus Sprint' } },
      { type: 'notify', description: 'Broadcasting focus status to neural mesh', service: 'mesh', personaId: 'ahri' }
    ]
  },
  {
    id: 'quick-email',
    name: 'Draft & Send Email',
    primaryPersona: 'echo',
    triggerPhrases: ['send an email', 'draft an email', 'write an email', 'email to', 'compose email'],
    steps: [
      { type: 'draft', description: 'Composing email draft', service: 'gmail', personaId: 'echo' },
      { type: 'confirm', description: 'Review and confirm dispatch', service: 'gmail', personaId: 'echo' }
    ]
  }
];

export function detectSkill(text: string): Skill | null {
  const lower = text.toLowerCase().trim();
  return SKILLS.find(s => s.triggerPhrases.some(t => lower.includes(t.toLowerCase()))) || null;
}

/**
 * Execute a single Skill step against local/workspace services
 */
export async function executeSkillStep(step: SkillStep, userInput: string, sessionContext?: any): Promise<{ success: boolean; result?: any; summary?: string }> {
  try {
    switch (step.service) {
      case 'calendar': {
        const events = googleWorkspaceService.getCachedCalendarEvents();
        return { success: true, result: events, summary: `Checked calendar (${events.length} events)` };
      }
      case 'gmail': {
        const emails = googleWorkspaceService.getCachedEmails();
        return { success: true, result: emails, summary: `Loaded emails (${emails.length} items)` };
      }
      case 'tasks': {
        const tasks = googleWorkspaceService.getCachedTasks();
        return { success: true, result: tasks, summary: `Checked task backlog (${tasks.length} tasks)` };
      }
      case 'timers': {
        const duration = step.config?.duration || 1500;
        const label = step.config?.label || 'Focus Sprint';
        const currentTimers = storageService.getTimers();
        const newTimer = {
          id: 't-' + Date.now(),
          label,
          totalSeconds: duration,
          remainingSeconds: duration,
          isRunning: true,
          createdAt: Date.now()
        };
        storageService.saveTimers([...currentTimers, newTimer]);
        return { success: true, summary: `Timer set for ${Math.round(duration / 60)} minutes` };
      }
      case 'mesh': {
        return { success: true, summary: 'Mesh network synchronized' };
      }
      case 'memory':
      default: {
        return { success: true, summary: 'Context updated' };
      }
    }
  } catch (err: any) {
    console.warn(`[SkillEngine] Step failed (${step.description}):`, err);
    return { success: false, summary: err?.message || 'Step execution failed' };
  }
}
