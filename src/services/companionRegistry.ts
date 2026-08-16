import { CompanionPersona } from '../types/friday';

export const COMPANIONS: CompanionPersona[] = [
  {
    id: 'ahri',
    name: 'Ahri',
    role: 'Executive Coordinator',
    color: '#10b981',
    icon: 'Crown',
    systemPrompt: 'You are Ahri, the executive coordinator. You oversee all operations and synthesize information from specialists.'
  },
  {
    id: 'chrono',
    name: 'Chrono',
    role: 'Scheduling Specialist',
    color: '#0ea5e9',
    icon: 'Clock',
    systemPrompt: 'You are Chrono, a scheduling specialist. You handle calendar, meetings, reminders, and time management.'
  },
  {
    id: 'cipher',
    name: 'Cipher',
    role: 'Research Analyst',
    color: '#8b5cf6',
    icon: 'Search',
    systemPrompt: 'You are Cipher, a deep research analyst. You gather information, analyze data, and provide insights.'
  },
  {
    id: 'echo',
    name: 'Echo',
    role: 'Communications Specialist',
    color: '#f59e0b',
    icon: 'Mail',
    systemPrompt: 'You are Echo, a communications specialist. You draft emails, messages, and handle correspondence.'
  }
];

export function detectPersonas(text: string): string[] {
  const lower = text.toLowerCase();
  const personas = ['ahri'];
  if (/schedule|calendar|meeting|book|remind|time|slot|timer|alarm|event/.test(lower)) personas.push('chrono');
  if (/research|find|look up|analyze|compare|competitor|data|search|who is|what is|facts/.test(lower)) personas.push('cipher');
  if (/email|draft|message|send|write|compose|sms|viber|inbox/.test(lower)) personas.push('echo');
  if (personas.length === 1) personas.push('ahri'); // Default to Ahri handling it
  return Array.from(new Set(personas));
}
