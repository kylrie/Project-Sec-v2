import { ConversationTurn } from '../types/friday';

export interface UserGoal {
  id: string;
  text: string;
  deadline: string;
  status: string;
}

export interface LearnedFact {
  fact: string;
  confidence: number;
  lastConfirmed: number;
}

export interface UserProfile {
  name: string;
  role: string;
  timezone: string;
  preferences: Record<string, string>;
  goals: UserGoal[];
  learnedFacts: LearnedFact[];
}

class UserMemoryService {
  private profile: UserProfile;

  constructor() {
    this.profile = this.load();
  }

  private load(): UserProfile {
    try {
      if (typeof window === 'undefined') return this.getDefaultProfile();
      const raw = localStorage.getItem('ahri_user_profile');
      return raw ? { ...this.getDefaultProfile(), ...JSON.parse(raw) } : this.getDefaultProfile();
    } catch {
      return this.getDefaultProfile();
    }
  }

  private getDefaultProfile(): UserProfile {
    return {
      name: 'Sir',
      role: 'Executive',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preferences: {},
      goals: [],
      learnedFacts: []
    };
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('ahri_user_profile', JSON.stringify(this.profile));
    } catch (e) {
      console.warn('[Memory] Failed to save profile to localStorage:', e);
    }
  }

  // Extract facts from conversation turns asynchronously
  async learnFromConversation(turns: ConversationTurn[] | Array<{ role: string; text: string; timestamp?: number }>) {
    const extractPrompt = `
      Extract 0-3 concise, important facts about the user's preferences, identity, schedule constraints, habits, or goals from this conversation.
      Return ONLY a valid JSON array of objects with the exact schema: [{"fact": "...", "confidence": 0.9}]
      If nothing new or specific to learn, return [].
      Conversation: ${JSON.stringify(turns.slice(-4).map(t => ({ role: t.role, text: (t as any).text || (t as any).content })))}
    `.trim();

    try {
      const res = await fetch('/api/extract-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: extractPrompt })
      });
      if (!res.ok) return;
      const facts: Array<{ fact: string; confidence: number }> = await res.json();
      if (!Array.isArray(facts)) return;

      let changed = false;
      for (const f of facts) {
        if (f.fact && !this.isDuplicate(f.fact)) {
          this.profile.learnedFacts.push({
            fact: f.fact,
            confidence: f.confidence || 0.8,
            lastConfirmed: Date.now()
          });
          changed = true;
        }
      }
      if (changed) {
        this.save();
      }
    } catch (e) {
      console.warn('[Memory] Learning failed:', e);
    }
  }

  private isDuplicate(fact: string): boolean {
    const norm = fact.toLowerCase().trim();
    return this.profile.learnedFacts.some(f => {
      const existing = f.fact.toLowerCase().trim();
      return existing.includes(norm) || norm.includes(existing);
    });
  }

  buildContextPrompt(): string {
    const topFacts = this.profile.learnedFacts
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 8)
      .map(f => f.fact)
      .join('. ');

    const prefs = Object.entries(this.profile.preferences || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return `
USER CONTEXT:
Name: ${this.profile.name || 'Sir'}
Role: ${this.profile.role || 'Executive'}
Timezone: ${this.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
Preferences: ${prefs || 'None recorded yet'}
Known facts: ${topFacts || 'None yet'}
    `.trim();
  }

  updateProfile(updates: Partial<UserProfile>) {
    this.profile = { ...this.profile, ...updates };
    this.save();
  }

  getProfile(): UserProfile {
    return this.profile;
  }
}

export const userMemory = new UserMemoryService();
