import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { dbRepository } from '../db/database.js';
import { FRIDAY_TOOLS, executeToolCall } from './tools.js';

export interface BrainProcessResult {
  intent: string;
  spokenReply: string;
  actionData: any;
  toolsUsed: string[];
  latencyMs: number;
  provider: 'openai-gpt4o' | 'gemini' | 'local-brain';
}

export class SecretaryBrain {
  private getOpenAIClient(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (key && key !== 'MY_OPENAI_API_KEY' && key.startsWith('sk-')) {
      return new OpenAI({ apiKey: key });
    }
    return null;
  }

  private getGeminiClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      return new GoogleGenAI({ apiKey: key });
    }
    return null;
  }

  /**
   * Main Agentic Processing Loop with Multi-turn Context & Dynamic Tool Calling
   */
  public async processCommand(params: {
    message: string;
    sessionId?: string;
    personality?: 'professional' | 'concise' | 'warm' | 'executive';
    userTimezone?: string;
  }): Promise<BrainProcessResult> {
    const startTime = Date.now();
    const sessionId = params.sessionId || 'default';
    const personality = params.personality || 'professional';
    const timezone = params.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 1. Fetch recent conversation memory & long-term facts from SQLite
    const recentHistory = dbRepository.getRecentConversations(sessionId, 6);
    const memoryFacts = dbRepository.getMemoryFacts(10);

    const memoryContext = memoryFacts.length > 0
      ? `\nKNOWN EXECUTIVE FACTS & PREFERENCES:\n${memoryFacts.map(f => `- ${f.fact_key}: ${f.fact_value}`).join('\n')}`
      : '';

    const personalityPrompts: Record<string, string> = {
      professional: "You are F.R.I.D.A.Y., Tony Stark's executive AI secretary and right-hand intelligence. Be impeccably professional, highly competent, calm, and proactive.",
      concise: "You are F.R.I.D.A.Y. Be ultra-compact, telegraphic, and direct. Answer in 1-2 sharp, decisive sentences. No filler words.",
      warm: "You are F.R.I.D.A.Y. Be warm, attentive, helpful, and courteous while maintaining high executive precision.",
      executive: "You are F.R.I.D.A.Y., Chief of Staff AI. Prioritize bottom-line outcomes, calendar leverage, and decisive action."
    };

    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.professional}
Current Server Time: ${new Date().toLocaleString('en-US', { timeZone: timezone })} (${timezone}).
${memoryContext}

Guidelines:
1. Always reason about the user's intent. If an action is required (scheduling events, checking emails, creating tasks, setting timers, searching contacts, saving facts), CALL THE APPROPRIATE TOOL(S).
2. You can perform multi-step actions (e.g. check calendar and schedule a meeting).
3. The spoken response will be fed directly into Text-To-Speech audio. KEEP IT NATURAL, CRISP, AND SPOKEN (No markdown symbols, no bullet asterisks, no hashtag headers, no tables).`;

    const openAiClient = this.getOpenAIClient();

    // 2. Try OpenAI GPT-4o with Tool Calling
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

        // Agentic Tool Loop (up to 3 iterations for multi-step reasoning)
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

          // Execute each tool call
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

        // Clean any markdown formatting for TTS
        const cleanSpoken = finalSpokenReply.replace(/[*#_`]/g, '').trim();
        const latencyMs = Date.now() - startTime;

        // Save conversation into SQLite
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

        return {
          intent: primaryIntent,
          spokenReply: cleanSpoken,
          actionData: mergedActionData,
          toolsUsed,
          latencyMs,
          provider: 'openai-gpt4o'
        };

      } catch (err: any) {
        console.warn('OpenAI GPT-4o execution error, falling back:', err?.message);
      }
    }

    // 3. Fallback: Gemini API
    const geminiClient = this.getGeminiClient();
    if (geminiClient) {
      try {
        const geminiPrompt = `${systemPrompt}
User message: "${params.message}"
Identify intent and produce a JSON with "intent", "spokenReply", and "actionData".`;

        const response = await geminiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: geminiPrompt,
          config: { responseMimeType: 'application/json' }
        });

        const parsed = JSON.parse(response.text || '{}');
        const latencyMs = Date.now() - startTime;
        const cleanSpoken = (parsed.spokenReply || response.text || "Understood, sir.").replace(/[*#_`]/g, '').trim();

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
          intent: parsed.intent || 'general_chat',
          latencyMs
        });

        return {
          intent: parsed.intent || 'general_chat',
          spokenReply: cleanSpoken,
          actionData: parsed.actionData || {},
          toolsUsed: ['gemini_nlu'],
          latencyMs,
          provider: 'gemini'
        };
      } catch (err) {
        console.warn('Gemini fallback error:', err);
      }
    }

    // 4. Intelligent Local Executive Brain with SQLite Tool Execution
    const lower = params.message.toLowerCase();
    let localIntent = 'general_chat';
    let localReply = "Understood, sir. Systems are standing by.";
    let localActionData: any = {};
    const localToolsUsed: string[] = [];

    // Schedule Event
    if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting') || lower.includes('book')) {
      let title = 'Executive Sync';
      let time = '02:00 PM';
      let date = 'Today';

      const timeMatch = params.message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
      if (timeMatch) time = timeMatch[1].toUpperCase();

      if (lower.includes('tomorrow')) date = 'Tomorrow';

      const cleaned = params.message
        .replace(/^(?:hey\s+)?(?:friday\s+)?(?:please\s+)?(?:schedule|set up|book|create)\s+(?:an?\s+)?/i, '')
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
      localReply = `I have scheduled ${title} for ${time} ${date}, sir.`;
      localActionData = event;
      localToolsUsed.push('calendar_schedule_event');
    }
    // Check Emails
    else if (lower.includes('email') || lower.includes('inbox')) {
      const unread = dbRepository.listEmails(true);
      localIntent = 'summarize_emails';
      localReply = unread.length > 0
        ? `You have ${unread.length} unread executive message${unread.length > 1 ? 's' : ''}, sir. The most urgent is from ${(unread[0] as any).from_name} regarding ${(unread[0] as any).subject}.`
        : `Your inbox is currently clear of urgent items, sir.`;
      localActionData = { emails: unread };
      localToolsUsed.push('gmail_list_emails');
    }
    // Tasks
    else if (lower.includes('task') || lower.includes('todo') || lower.includes('action item')) {
      const tasks = dbRepository.listTasks('pending');
      localIntent = 'list_tasks';
      localReply = tasks.length > 0
        ? `You have ${tasks.length} pending priority task${tasks.length > 1 ? 's' : ''}, sir. Next item: ${(tasks[0] as any).title}.`
        : `No pending tasks on your executive queue, sir.`;
      localActionData = { tasks };
      localToolsUsed.push('tasks_list_tasks');
    }
    // Timers
    else if (lower.includes('timer') || lower.includes('countdown')) {
      const timer = dbRepository.setTimer('Focus Timer', 300);
      localIntent = 'set_timer';
      localReply = `Five minute timer initiated, sir.`;
      localActionData = timer;
      localToolsUsed.push('timers_set_timer');
    }

    const latencyMs = Date.now() - startTime;

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

    return {
      intent: localIntent,
      spokenReply: localReply,
      actionData: localActionData,
      toolsUsed: localToolsUsed,
      latencyMs,
      provider: 'local-brain'
    };
  }
}

export const secretaryBrain = new SecretaryBrain();
