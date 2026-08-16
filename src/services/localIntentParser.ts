import { storageService } from './storage';
import { googleWorkspaceService } from './googleWorkspace';
import { ActiveTimer, ReminderItem } from '../types/friday';

export interface LocalParsedResult {
  isHandledLocally: boolean;
  intent: string;
  spokenReply: string;
  actionData?: Record<string, any>;
  timerCreated?: ActiveTimer;
  reminderCreated?: ReminderItem;
}

export function tryParseLocalIntent(rawText: string): LocalParsedResult | null {
  const text = rawText.trim().toLowerCase();

  // 1. Interruption / Stop
  if (/^(stop|never mind|nevermind|cancel|shut up|be quiet|abort|pause)$/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'system_control',
      spokenReply: 'Understood. Standing by.',
      actionData: { action: 'stop' }
    };
  }

  // 2. Pending Voice Confirmation Handling (e.g., User says "Send it", "Yes send", "Confirm", "No cancel")
  const memory = googleWorkspaceService.getContextMemory();
  if (memory.pendingVoiceConfirmation) {
    if (/^(yes|send it|send|authorize|confirm|go ahead|do it|proceed|yes please)$/i.test(text)) {
      const conf = memory.pendingVoiceConfirmation;
      if (conf.actionType === 'send_email') {
        googleWorkspaceService.sendEmail(conf.data.to, conf.data.subject, conf.data.body);
        return {
          isHandledLocally: true,
          intent: 'send_email_confirmed',
          spokenReply: `Email dispatched to ${conf.data.toName || conf.data.to} via Gmail.`,
          actionData: conf.data
        };
      }
    } else if (/^(no|cancel|discard|don't send|dont send|abort)$/i.test(text)) {
      googleWorkspaceService.saveContextMemory({ pendingVoiceConfirmation: null });
      return {
        isHandledLocally: true,
        intent: 'action_cancelled',
        spokenReply: 'Operation cancelled. The draft remains preserved in your workspace.',
        actionData: {}
      };
    }
  }

  // 3. Daily Morning Briefing: "give me my daily briefing", "good morning friday", "morning briefing", "daily report"
  if (/daily briefing|good morning|morning briefing|give me (my )?briefing|morning update|daily agenda briefing/i.test(text)) {
    const briefing = googleWorkspaceService.generateDailyBriefing();
    return {
      isHandledLocally: true,
      intent: 'morning_briefing',
      spokenReply: briefing.vocalScript,
      actionData: briefing
    };
  }

  // 4. Summarize Unread Emails: "summarize my unread emails", "check unread emails", "read my emails", "check inbox"
  if (/(summarize|read|check|any) (my )?(unread |urgent )?emails?|check my inbox|do i have any emails/i.test(text)) {
    const emails = googleWorkspaceService.getCachedEmails().filter(e => e.unread);
    const count = emails.length;
    if (count === 0) {
      return {
        isHandledLocally: true,
        intent: 'summarize_emails',
        spokenReply: 'You have zero unread emails in your inbox, sir. Everything is up to date.',
        actionData: { count: 0 }
      };
    }

    const urgent = emails.filter(e => e.urgencyLevel === 'urgent');
    let spokenReply = `You have ${count} unread emails.`;
    if (urgent.length > 0) {
      spokenReply += ` Priority note: ${urgent[0].summary1Sentence}`;
    } else {
      spokenReply += ` First message is from ${emails[0].fromName}: "${emails[0].subject}".`;
    }

    // Save context for "Reply to that" or "Open email"
    googleWorkspaceService.saveContextMemory({
      lastDiscussedEmail: {
        id: emails[0].id,
        subject: emails[0].subject,
        sender: emails[0].fromName,
        senderEmail: emails[0].fromEmail
      }
    });

    return {
      isHandledLocally: true,
      intent: 'summarize_emails',
      spokenReply,
      actionData: { count, emails }
    };
  }

  // 5. Draft Email: e.g. "draft an email to Alex saying I'll be 10 minutes late", "draft email to John Vance"
  const draftMatch = text.match(/draft (?:an )?email to ([a-zA-Z\s]+?)(?: saying| about| that) (.+)/i) ||
                     text.match(/send (?:an )?email to ([a-zA-Z\s]+?)(?: saying| about| that) (.+)/i);
  if (draftMatch) {
    const recipientRaw = draftMatch[1].trim();
    const content = draftMatch[2].trim();
    const subject = `Executive Update: ${content.slice(0, 30)}...`;
    const draft = googleWorkspaceService.createDraftEmail(recipientRaw, subject, content);

    return {
      isHandledLocally: true,
      intent: 'draft_email',
      spokenReply: `I have prepared the email to ${draft.toName} saying: "${content}". Shall I authorize and send it now?`,
      actionData: draft
    };
  }

  // 6. Direct "Send it" / "Send email"
  if (/^send (it|the email|that)$/i.test(text)) {
    const lastDraft = memory.lastDraftedEmail;
    if (lastDraft) {
      googleWorkspaceService.sendEmail(lastDraft.to, lastDraft.subject, lastDraft.body);
      return {
        isHandledLocally: true,
        intent: 'send_email_confirmed',
        spokenReply: `Dispatched email to ${lastDraft.toName || lastDraft.to} via Gmail.`,
        actionData: lastDraft
      };
    }
  }

  // 7. Search Emails: "find that email from Alex about the budget", "search emails for budget"
  const searchEmailMatch = text.match(/(?:find|search) (?:that |the )?emails? (?:from|about|for) (.+)/i);
  if (searchEmailMatch) {
    const query = searchEmailMatch[1].trim();
    const results = googleWorkspaceService.searchEmails(query);
    const count = results.length;
    const spokenReply = count > 0 
      ? `Found ${count} matching emails for "${query}". Top result is from ${results[0].fromName} regarding "${results[0].subject}".`
      : `No emails matching "${query}" were located in your current workspace cache.`;

    if (count > 0) {
      googleWorkspaceService.saveContextMemory({
        lastDiscussedEmail: {
          id: results[0].id,
          subject: results[0].subject,
          sender: results[0].fromName,
          senderEmail: results[0].fromEmail
        }
      });
    }

    return {
      isHandledLocally: true,
      intent: 'search_emails',
      spokenReply,
      actionData: { query, results }
    };
  }

  // 8. Schedule Calendar Event: e.g. "schedule a meeting with John tomorrow at 2 PM for 30 minutes"
  const scheduleMatch = text.match(/schedule (?:a )?(?:meeting|sync|call|briefing)(?: with ([a-zA-Z\s]+))?(?: (today|tomorrow|on [a-zA-Z]+))?(?: at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?(?: for (\d+)\s*(?:mins?|minutes?|hours?))?/i);
  if (scheduleMatch) {
    const attendee = (scheduleMatch[1] || 'Team').trim();
    const day = (scheduleMatch[2] || 'today').trim();
    const timeStr = (scheduleMatch[3] || '2:00 PM').trim();
    const duration = parseInt(scheduleMatch[4] || '30', 10);

    const targetDate = new Date();
    if (day.includes('tomorrow')) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    // Parse hour
    const hourMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let hours = 14;
    let mins = 0;
    if (hourMatch) {
      hours = parseInt(hourMatch[1], 10);
      if (hourMatch[2]) mins = parseInt(hourMatch[2], 10);
      const ampm = (hourMatch[3] || '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }
    targetDate.setHours(hours, mins, 0, 0);

    const title = `Sync with ${attendee}`;
    const result = googleWorkspaceService.createCalendarEvent({
      summary: title,
      startDateTime: targetDate.toISOString(),
      durationMinutes: duration,
      attendeeNamesOrEmails: [attendee],
      location: 'Google Meet'
    });

    return {
      isHandledLocally: true,
      intent: 'schedule_event',
      spokenReply: `Scheduled ${title} for ${day} at ${timeStr} for ${duration} minutes on Google Calendar with a Google Meet link.`,
      actionData: { title, targetDate: targetDate.toISOString(), duration, attendee }
    };
  }

  // 9. Conflict / Schedule Check: "do I have any conflicts tomorrow afternoon?", "find me a 45-minute slot"
  if (/find (?:me )?(?:a )?(\d+)\s*(?:min|minute)s? slot/i.test(text)) {
    const match = text.match(/(\d+)\s*(?:min|minute)s?/i);
    const mins = match ? parseInt(match[1], 10) : 45;
    const slots = googleWorkspaceService.findSmartSlots(mins);
    return {
      isHandledLocally: true,
      intent: 'find_free_slots',
      spokenReply: `I found optimal open slots for a ${mins}-minute sync: ${slots.join(', ')}. Which one shall I book?`,
      actionData: { duration: mins, slots }
    };
  }

  if (/conflict|check conflicts|any overlaps/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'check_conflicts',
      spokenReply: `All calendar slots for today are reconciled without overlapping conflicts, sir.`,
      actionData: { conflicts: [] }
    };
  }

  // 10. Cancel / Delete recent meeting: "cancel that meeting", "delete that event"
  if (/cancel that (meeting|event|appointment)|delete that (meeting|event)/i.test(text)) {
    const lastEvt = memory.lastDiscussedEvent;
    if (lastEvt) {
      googleWorkspaceService.deleteCalendarEvent(lastEvt.id);
      return {
        isHandledLocally: true,
        intent: 'delete_event',
        spokenReply: `Cancelled "${lastEvt.title}" from your Google Calendar.`,
        actionData: { eventId: lastEvt.id, title: lastEvt.title }
      };
    }
  }

  // 11. Google Tasks: "add 'buy milk' to my tasks", "add buy milk to my to-do list"
  const addTaskMatch = text.match(/add (?:["']?)(.+?)(?:["']?) to (?:my )?(?:tasks|to-do list|todo list|tasks list|shopping list)/i);
  if (addTaskMatch) {
    const taskTitle = addTaskMatch[1].trim();
    googleWorkspaceService.createTask(taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1));
    return {
      isHandledLocally: true,
      intent: 'create_task',
      spokenReply: `Added "${taskTitle}" to your Google Tasks.`,
      actionData: { title: taskTitle }
    };
  }

  // 12. List Tasks / What tasks are due today?
  if (/what tasks are due|check (my )?tasks|show (my )?to-dos|what is on my to-do list/i.test(text)) {
    const tasks = googleWorkspaceService.getCachedTasks().filter(t => t.status === 'needsAction');
    const count = tasks.length;
    const spokenReply = count > 0 
      ? `You have ${count} pending tasks on Google Tasks. Highest priority is: "${tasks[0].title}".`
      : `You have completed all pending tasks, sir.`;

    return {
      isHandledLocally: true,
      intent: 'list_tasks',
      spokenReply,
      actionData: { count, tasks }
    };
  }

  // 13. Complete task: "mark 'review budget' as complete"
  const completeTaskMatch = text.match(/mark (?:["']?)(.+?)(?:["']?) as (?:complete|completed|done)/i);
  if (completeTaskMatch) {
    const taskQuery = completeTaskMatch[1].toLowerCase().trim();
    const tasks = googleWorkspaceService.getCachedTasks();
    const found = tasks.find(t => t.title.toLowerCase().includes(taskQuery));
    if (found) {
      googleWorkspaceService.toggleTaskStatus(found.id, true);
      return {
        isHandledLocally: true,
        intent: 'complete_task',
        spokenReply: `Marked "${found.title}" as completed in Google Tasks.`,
        actionData: { taskId: found.id, title: found.title }
      };
    }
  }

  // 14. Time query
  if (/what('s| is) the time|what time is it|current time|tell me the time/i.test(text)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    return {
      isHandledLocally: true,
      intent: 'get_time',
      spokenReply: `It is currently ${timeStr} on ${dateStr}, sir.`,
      actionData: { time: timeStr, date: dateStr }
    };
  }

  // 15. Set a Timer
  const timerMatch = text.match(/set (?:a )?timer (?:for )?(\d+)\s*(minute|min|second|sec|hour|hr)s?(?: (?:for|called|named) (.+))?/i) ||
                     text.match(/(\d+)\s*(minute|min|second|sec|hour|hr)s? timer(?: (?:for|called|named) (.+))?/i);
  if (timerMatch) {
    const amount = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2].toLowerCase();
    const label = (timerMatch[3] || 'Timer').trim();

    let totalSeconds = amount * 60;
    if (unit.startsWith('sec')) {
      totalSeconds = amount;
    } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
      totalSeconds = amount * 3600;
    }

    const newTimer: ActiveTimer = {
      id: 'tmr-' + Math.random().toString(36).substring(2, 9),
      label: label.charAt(0).toUpperCase() + label.slice(1),
      totalSeconds,
      remainingSeconds: totalSeconds,
      isRunning: true,
      createdAt: Date.now()
    };

    const currentTimers = storageService.getTimers();
    storageService.saveTimers([...currentTimers, newTimer]);

    const unitText = unit.startsWith('sec') ? 'seconds' : (unit.startsWith('hour') ? 'hours' : 'minutes');
    return {
      isHandledLocally: true,
      intent: 'set_timer',
      spokenReply: `Timer set for ${amount} ${unitText}. Counting down now.`,
      actionData: { durationSeconds: totalSeconds, label: newTimer.label },
      timerCreated: newTimer
    };
  }

  // 16. Weather query
  if (/weather|temperature|is it raining|forecast/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'get_weather',
      spokenReply: `Conditions are optimal. Currently 72 degrees Fahrenheit and partly sunny, with a gentle westerly breeze.`,
      actionData: { tempF: 72, tempC: 22, condition: 'Partly Sunny', humidity: '45%' }
    };
  }

  // 17. Schedule / Daily Calendar
  if (/what('s| is) on my (calendar|agenda)|my meetings today/i.test(text)) {
    const events = googleWorkspaceService.getCachedCalendarEvents();
    const count = events.length;
    const firstEvent = events[0];
    const firstTime = firstEvent?.start.dateTime ? new Date(firstEvent.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '9:00 AM';

    const reply = count > 0
      ? `You have ${count} appointments scheduled today. Your next commitment is ${firstEvent.summary} at ${firstTime}.`
      : `Your calendar is clear for today, sir. No scheduled conflicts.`;

    return {
      isHandledLocally: true,
      intent: 'get_schedule',
      spokenReply: reply,
      actionData: { eventCount: count, nextEvent: firstEvent }
    };
  }

  // 18. Meeting Intelligence Voice Commands
  // 18a. Start Meeting / Record Minutes: "start meeting minutes", "start recording meeting", "record this meeting", "take meeting minutes"
  if (/start (?:the )?(?:meeting(?: minutes)?|recording(?: meeting)?)|take meeting minutes|record this meeting/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'start_meeting_recording',
      spokenReply: `Initiating meeting intelligence recording with acoustic speaker diarization. Visual recording indicator active.`,
      actionData: { mode: 'ambient_recording', recordingStarted: true }
    };
  }

  // 18b. Smart Bookmark / Flag Moment: "flag that", "FRIDAY flag that", "bookmark this moment", "mark this decision"
  if (/(?:friday,? )?(?:flag (?:that|this)|bookmark (?:this|that)|mark (?:this|that) (?:moment|decision))/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'flag_meeting_moment',
      spokenReply: `Milestone flagged. I have marked this timestamp for executive review in your post-meeting debrief.`,
      actionData: { flagged: true, timestamp: new Date().toLocaleTimeString() }
    };
  }

  // 18c. End Meeting & Generate Minutes: "stop recording meeting", "end meeting", "generate meeting minutes", "summarize meeting"
  if (/(?:stop|end) (?:the )?meeting|stop recording|generate (?:the )?meeting minutes|summarize (?:this )?meeting/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'end_meeting_generate_minutes',
      spokenReply: `Meeting concluded. Analyzing transcript and extracting executive summary, decisions, and action items.`,
      actionData: { status: 'analyzing' }
    };
  }

  // 18d. Join Google Meet: "join my google meet", "join upcoming meeting", "join meet"
  if (/join (?:my |the )?(?:google )?meet(?:ing)?/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'join_google_meet',
      spokenReply: `Opening your upcoming Google Meet conference link and initiating silent bot attendance with real-time transcription.`,
      actionData: { joinMeet: true }
    };
  }

  // 18e. Sync Meeting Action Items to Google Tasks: "sync action items", "add action items to google tasks", "save meeting tasks"
  if (/sync (?:meeting )?action items|add (?:meeting )?action items to (?:google )?tasks|save (?:meeting )?tasks/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'sync_meeting_tasks',
      spokenReply: `All extracted meeting action items have been synchronized to your Google Tasks queue with their owners and deadlines.`,
      actionData: { syncGoogleTasks: true }
    };
  }

  // 19. Communications & Telephony Voice Commands
  // 19a. Phone Call: "call John", "call Mom", "dial Alex", "call +1 555-019-2834"
  const callMatch = text.match(/(?:call|dial|phone) (?:up )?([a-zA-Z0-9\s+()-]+)/i);
  if (callMatch && !/meeting|minutes|timer|task|uber|viber/i.test(text)) {
    const contactTarget = callMatch[1].trim();
    return {
      isHandledLocally: true,
      intent: 'initiate_phone_call',
      spokenReply: `Initiating cellular voice call to ${contactTarget} via native telephony dialer.`,
      actionData: { contact: contactTarget }
    };
  }

  // 19b. Incoming Call Controls: "answer call", "decline call", "send to voicemail"
  if (/answer (?:the )?call|accept (?:the )?call|pick up/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'answer_phone_call',
      spokenReply: `Call connected. Real-time audio screening and live transcription active.`,
      actionData: { action: 'answer' }
    };
  }

  if (/decline (?:the )?call|reject (?:the )?call|hang up/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'decline_phone_call',
      spokenReply: `Call declined. Dispatching polite auto-responder message to caller.`,
      actionData: { action: 'decline' }
    };
  }

  if (/send to voicemail|take a message/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'send_to_voicemail',
      spokenReply: `Routing incoming call to AHRI AI Voicemail with automated transcript capture.`,
      actionData: { action: 'voicemail' }
    };
  }

  // 19c. Post-call summary: "summarize my last call", "what did John say on the call"
  if (/summarize (?:my |the )?(?:last )?call|what did (?:.+?) say on the call/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'summarize_last_call',
      spokenReply: `Retrieving call log: You have zero recent recorded calls on record.`,
      actionData: { callSummary: true }
    };
  }

  // 19d. SMS Texting: "tell Mom on SMS I'll be there at 7", "send SMS to Alex saying approved", "text John saying I'm 10 mins late"
  const smsMatch = text.match(/(?:send (?:an? )?sms to|text|send text to) ([a-zA-Z0-9\s]+?)(?: saying| with message| that|:) (.+)/i);
  if (smsMatch) {
    const recipient = smsMatch[1].trim();
    const msgBody = smsMatch[2].trim();
    return {
      isHandledLocally: true,
      intent: 'send_sms_voice',
      spokenReply: `Sending SMS to ${recipient}: "${msgBody}". Message dispatched via cellular gateway.`,
      actionData: { recipient, message: msgBody, channel: 'sms' }
    };
  }

  // 19e. Viber Integration: "tell John on Viber I'll be 10 minutes late", "send Viber message to Alex saying hello"
  const viberMatch = text.match(/(?:tell|message|send(?: a)? message to|send viber to) ([a-zA-Z0-9\s]+?) on viber(?: saying| that|:) (.+)/i) ||
                     text.match(/(?:on viber(?: tell| message) ([a-zA-Z0-9\s]+?)(?: saying| that|:) (.+))/i);
  if (viberMatch) {
    const recipient = viberMatch[1].trim();
    const msgBody = viberMatch[2].trim();
    return {
      isHandledLocally: true,
      intent: 'send_viber_voice',
      spokenReply: `Transmitting message to ${recipient} via Viber Bot API: "${msgBody}".`,
      actionData: { recipient, message: msgBody, channel: 'viber' }
    };
  }

  // 19f. Facebook Messenger: "tell John on Messenger I'm on my way", "send Messenger message to Alex saying review complete"
  const messengerMatch = text.match(/(?:tell|message|send(?: a)? message to) ([a-zA-Z0-9\s]+?) on (?:facebook )?messenger(?: saying| that|:) (.+)/i);
  if (messengerMatch) {
    const recipient = messengerMatch[1].trim();
    const msgBody = messengerMatch[2].trim();
    return {
      isHandledLocally: true,
      intent: 'send_messenger_voice',
      spokenReply: `Transmitting message to ${recipient} via Facebook Messenger: "${msgBody}".`,
      actionData: { recipient, message: msgBody, channel: 'messenger' }
    };
  }

  // 19g. Messenger / Viber Group Chat Summarizer: "what did the group say", "summarize Messenger group", "what is happening in the group chat"
  if (/what did the (?:team |operations |family )?group say|summarize (?:the )?(?:messenger|viber|team|operations)?\s*group(?: chat)?|summarize (?:the )?chat/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'summarize_messenger_group',
      spokenReply: `In the Executive Operations group chat over the last 24 hours: Demo User 2 confirmed the workshop reservation for Saturday at 11 AM, equipment is staged, and demonstration prototypes will arrive by 2 PM. Everyone is aligned.`,
      actionData: { groupName: 'Executive Operations & Planning' }
    };
  }

  // 19h. Smart OTP / Verification Code reader: "read my OTP", "what is my verification code", "copy verification code"
  if (/read (?:my )?(?:otp|verification code|security code)|what is my (?:otp|verification code)|copy (?:the )?(?:otp|verification code)/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'read_otp_code',
      spokenReply: `Your Cloud Security verification code is 849-215. It has been copied to your executive clipboard.`,
      actionData: { otpCode: '849-215' }
    };
  }

  // 19i. Communication Digest: "communication digest", "read my messages", "what are my unread messages", "check my inbox"
  if (/communication digest|read (?:my )?(?:messages|texts|inbox)|what are my (?:unread )?messages|check (?:my )?messages/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'get_communication_digest',
      spokenReply: `You have 4 unread communications across SMS, Viber, Facebook Messenger, and a missed call. 2 are high priority. Shall I read the details?`,
      actionData: { triggerDigest: true }
    };
  }

  // 19j. Do Not Disturb & Meeting Auto-Responder: "I'm in a meeting, only interrupt for emergencies", "turn on DND", "enable meeting mode"
  if (/i('m| am) in a meeting|only interrupt for emergencies|turn on (?:dnd|do not disturb)|enable (?:meeting|dnd) mode/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'enable_dnd_meeting',
      spokenReply: `Do Not Disturb activated with Meeting Auto-Responder. Only verified emergency keywords and VIP contacts like Pepper Potts and Mom will break through.`,
      actionData: { dndMode: 'meeting', autoResponder: true }
    };
  }

  // 19k. Driving Mode: "turn on driving mode", "hands-free driving mode"
  if (/turn on driving mode|enable driving mode|hands-?free (?:driving )?mode/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'enable_driving_mode',
      spokenReply: `Hands-free Driving Mode engaged. I will announce all incoming SMS, Viber, and Messenger notifications aloud and prompt for voice replies.`,
      actionData: { dndMode: 'driving', drivingMode: true }
    };
  }

  // 19l. Disable DND: "turn off DND", "disable do not disturb", "disable driving mode"
  if (/turn off (?:dnd|do not disturb|driving mode)|disable (?:dnd|do not disturb|driving mode)/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'disable_dnd',
      spokenReply: `Do Not Disturb disabled. Standard notification routing and volume levels restored.`,
      actionData: { dndMode: 'off' }
    };
  }

  // 20. Identity & Status
  if (/who are you|what are you|what is your name/i.test(text)) {
    return {
      isHandledLocally: true,
      intent: 'system_status',
      spokenReply: `I am FRIDAY, your executive digital secretary and cross-platform assistant with unified communications intelligence across Viber, Messenger, SMS, and native telephony. All systems online.`,
      actionData: { status: 'optimal' }
    };
  }

  return null;
}

