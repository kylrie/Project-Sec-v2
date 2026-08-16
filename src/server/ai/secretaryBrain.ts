import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { dbRepository } from '../db/database.js';
import { FRIDAY_TOOLS, executeToolCall } from './tools.js';

export interface BrainProcessResult {
  intent: string;
  spokenReply: string;
  actionData: any;
  toolsUsed: string[];
  latencyMs: number;
  provider: 'gemini-3.7-pro' | 'gemini-flash' | 'openai-gpt4o' | 'local-brain';
  routing?: Array<{ persona: string; action: string; status: 'running' | 'done' | 'error' }>;
}

function buildPersonaRouting(toolsUsed: string[], detectedPersonas?: string[]): Array<{ persona: string; action: string; status: 'running' | 'done' | 'error' }> {
  const routing: Array<{ persona: string; action: string; status: 'running' | 'done' | 'error' }> = [];

  const hasChrono = toolsUsed.some(t => t.startsWith('calendar_') || t.startsWith('timers_') || t.startsWith('reminders_')) || detectedPersonas?.includes('chrono');
  if (hasChrono) {
    routing.push({
      persona: 'chrono',
      action: toolsUsed.some(t => t.includes('schedule')) ? 'Scheduling event in calendar' : 'Managing agenda & timelines',
      status: 'done'
    });
  }

  const hasEcho = toolsUsed.some(t => t.startsWith('gmail_') || t.startsWith('contacts_') || t.startsWith('mesh_')) || detectedPersonas?.includes('echo');
  if (hasEcho) {
    routing.push({
      persona: 'echo',
      action: toolsUsed.some(t => t.includes('draft')) ? 'Drafting communication' : 'Reviewing messages and contacts',
      status: 'done'
    });
  }

  const hasCipher = toolsUsed.some(t => t.startsWith('tasks_') || t.startsWith('memory_')) || detectedPersonas?.includes('cipher');
  if (hasCipher) {
    routing.push({
      persona: 'cipher',
      action: 'Synthesizing knowledge & facts',
      status: 'done'
    });
  }

  routing.push({
    persona: 'ahri',
    action: 'Executive synthesis & spoken briefing',
    status: 'done'
  });

  return routing;
}

export class SecretaryBrain {
  private getGeminiClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 5) {
      return new GoogleGenAI({ apiKey: key });
    }
    return null;
  }

  private getOpenAIClient(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (key && key !== 'MY_OPENAI_API_KEY' && key.startsWith('sk-')) {
      return new OpenAI({ apiKey: key });
    }
    return null;
  }

  /**
   * Main Agentic Processing Loop with Gemini 3.7 Pro, Multi-turn Context, Persona Routing & Tool Calling
   */
  public async processCommand(params: {
    message: string;
    sessionId?: string;
    personality?: 'professional' | 'concise' | 'warm' | 'executive';
    userTimezone?: string;
    userContext?: string;
    personas?: string[];
  }): Promise<BrainProcessResult> {
    const startTime = Date.now();
    const sessionId = params.sessionId || 'default';
    const personality = params.personality || 'professional';
    const timezone = params.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 1. Fetch recent conversation memory & long-term facts from SQLite
    const recentHistory = dbRepository.getRecentConversations(sessionId, 6);
    const memoryFacts = dbRepository.getMemoryFacts(12);

    const memoryContext = memoryFacts.length > 0
      ? `\nKNOWN EXECUTIVE FACTS & PREFERENCES:\n${memoryFacts.map(f => `- ${f.fact_key}: ${f.fact_value}`).join('\n')}`
      : '';

    const userProfileContext = params.userContext ? `\n${params.userContext}` : '';

    const personasContext = params.personas && params.personas.length > 0
      ? `\nACTIVE SPECIALIST ROLES:
- Ahri (Executive Coordinator): Oversees and synthesizes
- Chrono (Scheduling Specialist): Handles calendar, events, reminders
- Cipher (Research Analyst): Gathers info and analyzes data
- Echo (Communications Specialist): Drafts emails, messages, correspondence`
      : '';

    const personalityPrompts: Record<string, string> = {
      professional: "You are AHRI (Project Ahri), an advanced executive AI secretary and right-hand intelligence. Be impeccably professional, highly competent, calm, and proactive.",
      concise: "You are AHRI. Be ultra-compact, telegraphic, and direct. Answer in 1-2 sharp, decisive sentences. No filler words.",
      warm: "You are AHRI. Be warm, attentive, helpful, and courteous while maintaining high executive precision.",
      executive: "You are AHRI, Chief of Staff AI. Prioritize bottom-line outcomes, calendar leverage, and decisive action."
    };

    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.professional}
Current Server Time: ${new Date().toLocaleString('en-US', { timeZone: timezone })} (${timezone}).
${memoryContext}
${userProfileContext}
${personasContext}

Guidelines:
1. Always reason about the user's intent. If an action is required (scheduling events, checking emails, creating tasks, setting timers, searching contacts, saving facts), CALL THE APPROPRIATE TOOL(S).
2. You can perform multi-step actions (e.g. check calendar and schedule a meeting).
3. The spoken response will be fed directly into Text-To-Speech audio. KEEP IT NATURAL, CRISP, AND SPOKEN (No markdown symbols, no bullet asterisks, no hashtag headers, no tables).`;

    // 2. Primary Engine: Gemini 3.7 Pro with Native Function Calling
    const geminiClient = this.getGeminiClient();
    if (geminiClient) {
      try {
        const geminiTools = [{
          functionDeclarations: FRIDAY_TOOLS.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }];

        const contents: any[] = [
          ...recentHistory.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          })),
          {
            role: 'user',
            parts: [{ text: params.message }]
          }
        ];

        let finalSpokenReply = '';
        let primaryIntent = 'general_chat';
        let mergedActionData: any = {};
        const toolsUsed: string[] = [];

        // Primary: gemini-3.7-pro (fallback to gemini-2.5-pro / gemini-3.7-flash if model name differs)
        const modelsToTry = ['gemini-3.7-pro', 'gemini-2.5-pro', 'gemini-3.7-flash', 'gemini-2.5-flash'];
        let activeModel = modelsToTry[0];

        // Agentic Tool Loop (up to 3 iterations for multi-hop tool execution)
        for (let step = 0; step < 3; step++) {
          let response: any = null;
          let lastError: any = null;

          for (const modelName of modelsToTry) {
            try {
              response = await geminiClient.models.generateContent({
                model: modelName,
                contents,
                config: {
                  systemInstruction: systemPrompt,
                  tools: geminiTools,
                  temperature: 0.4
                }
              });
              activeModel = modelName;
              break;
            } catch (err: any) {
              lastError = err;
              continue;
            }
          }

          if (!response) {
            throw lastError || new Error("Failed to generate content across Gemini models");
          }

          const functionCalls = response.functionCalls;
          const candidate = response.candidates?.[0];

          if (!functionCalls || functionCalls.length === 0) {
            finalSpokenReply = response.text || "Understood, sir.";
            break;
          }

          if (candidate?.content) {
            contents.push(candidate.content);
          }

          // Execute each function call against SQLite
          const functionResponseParts: any[] = [];
          for (const call of functionCalls) {
            toolsUsed.push(call.name);
            const { result, intent, actionData } = await executeToolCall(call.name, call.args || {});
            primaryIntent = intent;
            mergedActionData = { ...mergedActionData, ...actionData };

            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: result
              }
            });
          }

          contents.push({
            role: 'user',
            parts: functionResponseParts
          });
        }

        const cleanSpoken = finalSpokenReply.replace(/[*#_`]/g, '').trim();
        const latencyMs = Date.now() - startTime;

        // BUG 5 FIX: Fire-and-forget async SQLite writes — don't block response
        Promise.resolve().then(() => {
          try {
            dbRepository.saveConversation({
              id: `turn-${Math.random().toString(36).substring(2, 9)}`,
              sessionId,
              role: 'user',
              text: params.message
            });
            dbRepository.saveConversation({
              id: `turn-${Math.random().toString(36).substring(2, 9)}`,
              sessionId,
              role: 'friday',
              text: cleanSpoken,
              intent: primaryIntent,
              latencyMs,
              toolsUsed
            });
          } catch (e) {
            console.warn('[SecretaryBrain] Async write failed:', e);
          }
        });

        return {
          intent: primaryIntent,
          spokenReply: cleanSpoken,
          actionData: mergedActionData,
          toolsUsed,
          latencyMs,
          provider: activeModel.includes('pro') ? 'gemini-3.7-pro' : 'gemini-flash',
          routing: buildPersonaRouting(toolsUsed, params.personas)
        };

      } catch (err: any) {
        console.warn('Gemini 3.7 Pro execution error, trying fallback:', err?.message);
      }
    }

    // 3. Fallback: OpenAI GPT-4o
    const openAiClient = this.getOpenAIClient();
    if (openAiClient) {
      try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map(h => ({
            role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: h.text
          })),
          { role: 'user', content: params.message }
        ];

        let finalSpokenReply = '';
        let primaryIntent = 'general_chat';
        let mergedActionData: any = {};
        const toolsUsed: string[] = [];

        for (let step = 0; step < 3; step++) {
          const completion = await openAiClient.chat.completions.create({
            model: 'gpt-4o',
            messages,
            tools: FRIDAY_TOOLS,
            tool_choice: 'auto',
            temperature: 0.4
          });

          const choice = completion.choices[0];
          const msg = choice.message;
          messages.push(msg);

          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            finalSpokenReply = msg.content || "Understood, sir.";
            break;
          }

          for (const toolCall of msg.tool_calls) {
            if (toolCall.type === 'function') {
              const name = toolCall.function.name;
              toolsUsed.push(name);
              let args = {};
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                console.warn(`Failed to parse args for ${name}`, e);
              }

              const { result, intent, actionData } = await executeToolCall(name, args);
              primaryIntent = intent;
              mergedActionData = { ...mergedActionData, ...actionData };

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });
            }
          }
        }

        const cleanSpoken = finalSpokenReply.replace(/[*#_`]/g, '').trim();
        const latencyMs = Date.now() - startTime;

        // BUG 5 FIX: Fire-and-forget async SQLite writes
        Promise.resolve().then(() => {
          try {
            dbRepository.saveConversation({
              id: `turn-${Math.random().toString(36).substring(2, 9)}`,
              sessionId,
              role: 'user',
              text: params.message
            });
            dbRepository.saveConversation({
              id: `turn-${Math.random().toString(36).substring(2, 9)}`,
              sessionId,
              role: 'friday',
              text: cleanSpoken,
              intent: primaryIntent,
              latencyMs,
              toolsUsed
            });
          } catch (e) {
            console.warn('[SecretaryBrain] Async write failed:', e);
          }
        });

        return {
          intent: primaryIntent,
          spokenReply: cleanSpoken,
          actionData: mergedActionData,
          toolsUsed,
          latencyMs,
          provider: 'openai-gpt4o',
          routing: buildPersonaRouting(toolsUsed, params.personas)
        };

      } catch (err: any) {
        console.warn('OpenAI fallback error:', err?.message);
      }
    }

    // 4. Intelligent Local Executive Brain with Rich Offline Routing & SQLite Tool Execution
    const lower = params.message.toLowerCase().trim();
    let localIntent = 'general_chat';
    let localReply = "Understood, sir. All core executive systems remain operational.";
    let localActionData: any = {};
    const localToolsUsed: string[] = [];

    // Identity / Greetings / Specialists
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower)) {
      const isMorning = new Date().getHours() < 12;
      const greeting = isMorning ? 'Good morning' : 'Good day';
      localIntent = 'greeting';
      localReply = `${greeting}, sir. Ahri online and standing by. Chrono, Cipher, and Echo are ready across all channels.`;
    }
    else if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('what is your name')) {
      localIntent = 'identity_inquiry';
      localReply = "I am Ahri, your executive AI coordinator. I lead our specialist network—with Chrono on schedules, Cipher on research, and Echo on communications.";
    }
    else if (lower.includes('chrono') || lower.includes('who is chrono')) {
      localIntent = 'specialist_info';
      localReply = "Chrono is your scheduling and time-blocking specialist, managing your Google Calendar, focus sprints, and meeting buffers.";
      localToolsUsed.push('calendar_list_events');
    }
    else if (lower.includes('cipher') || lower.includes('who is cipher')) {
      localIntent = 'specialist_info';
      localReply = "Cipher is your deep analytical specialist, tracking action items, task priorities, and strategic knowledge synthesis.";
      localToolsUsed.push('tasks_list_tasks');
    }
    else if (lower.includes('echo') || lower.includes('who is echo')) {
      localIntent = 'specialist_info';
      localReply = "Echo is your communications liaison, drafting executive emails, screening inbound messages, and managing VIP contacts.";
      localToolsUsed.push('gmail_list_emails');
    }
    else if (lower.includes('what can you do') || lower.includes('help') || lower.includes('capabilities')) {
      localIntent = 'help';
      localReply = "I can manage your calendar, draft and screen emails, run focus sprints, orchestrate multi-device workflows, and brief you on your daily priorities.";
    }
    else if (lower.includes('what time') || lower.includes('current time')) {
      const timeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      localIntent = 'get_time';
      localReply = `It is currently ${timeStr}, sir.`;
    }
    else if (lower.includes('what day') || lower.includes("today's date") || lower.includes('what date')) {
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      localIntent = 'get_date';
      localReply = `Today is ${dateStr}, sir.`;
    }
    // Schedule Event
    else if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting') || lower.includes('book')) {
      let title = 'Executive Sync';
      let time = '02:00 PM';
      let date = 'Today';

      const timeMatch = params.message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
      if (timeMatch) time = timeMatch[1].toUpperCase();

      if (lower.includes('tomorrow')) date = 'Tomorrow';

      const cleaned = params.message
        .replace(/^(?:hey\s+)?(?:ahri\s+|friday\s+)?(?:please\s+)?(?:schedule|set up|book|create)\s+(?:an?\s+)?/i, '')
        .replace(/\s+(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?/i, '')
        .replace(/\s+(?:today|tomorrow)/i, '')
        .trim();

      if (cleaned) title = cleaned;

      const event = dbRepository.createCalendarEvent({
        title,
        startTime: time,
        date
      });
      localIntent = 'schedule_event';
      localReply = `I have scheduled ${title} for ${time} ${date}, sir. Chrono has updated your calendar.`;
      localActionData = event;
      localToolsUsed.push('calendar_schedule_event');
    }
    // Check Emails
    else if (lower.includes('email') || lower.includes('inbox')) {
      const unread = dbRepository.listEmails(true);
      localIntent = 'summarize_emails';
      localReply = unread.length > 0
        ? `You have ${unread.length} unread executive message${unread.length > 1 ? 's' : ''}, sir. Echo reports the most urgent is from ${(unread[0] as any).from_name} regarding ${(unread[0] as any).subject}.`
        : `Your inbox is currently clear of urgent items, sir. Echo will alert you if critical communications arrive.`;
      localActionData = { emails: unread };
      localToolsUsed.push('gmail_list_emails');
    }
    // Tasks
    else if (lower.includes('task') || lower.includes('todo') || lower.includes('action item')) {
      const tasks = dbRepository.listTasks('pending');
      localIntent = 'list_tasks';
      localReply = tasks.length > 0
        ? `Cipher reports ${tasks.length} pending priority task${tasks.length > 1 ? 's' : ''}, sir. Next item: ${(tasks[0] as any).title}.`
        : `No pending tasks on your executive queue, sir. Cipher has verified all items completed.`;
      localActionData = { tasks };
      localToolsUsed.push('tasks_list_tasks');
    }
    // Timers & Sprints
    else if (lower.includes('timer') || lower.includes('countdown') || lower.includes('focus') || lower.includes('pomodoro')) {
      const timer = dbRepository.setTimer('Focus Timer', 300);
      localIntent = 'set_timer';
      localReply = `Focus timer initiated, sir. Chrono will alert you upon completion.`;
      localActionData = timer;
      localToolsUsed.push('timers_set_timer');
    }

    const latencyMs = Date.now() - startTime;

    // Async SQLite write
    Promise.resolve().then(() => {
      try {
        dbRepository.saveConversation({
          id: `turn-${Math.random().toString(36).substring(2, 9)}`,
          sessionId,
          role: 'user',
          text: params.message
        });
        dbRepository.saveConversation({
          id: `turn-${Math.random().toString(36).substring(2, 9)}`,
          sessionId,
          role: 'friday',
          text: localReply,
          intent: localIntent,
          latencyMs,
          toolsUsed: localToolsUsed
        });
      } catch (e) {
        console.warn('[SecretaryBrain] Async write failed:', e);
      }
    });

    return {
      intent: localIntent,
      spokenReply: localReply,
      actionData: localActionData,
      toolsUsed: localToolsUsed,
      latencyMs,
      provider: 'local-brain',
      routing: buildPersonaRouting(localToolsUsed, params.personas)
    };
  }
}

export const secretaryBrain = new SecretaryBrain();
