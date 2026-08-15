import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/client/services/apiClient';
import { Suggestion } from '@/client/components/SuggestionCard';

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ suggestions: Suggestion[] }>('/api/suggestions/proactive');
      setSuggestions(res?.suggestions || []);
    } catch (e) {
      console.error('Failed to fetch suggestions:', e);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSuggestions();
    // Refresh every 15 minutes
    const interval = setInterval(fetchSuggestions, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const dismiss = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    apiPost('/api/suggestions/feedback', { suggestionId: id, action: 'dismissed' }).catch(() => {});
  };
  
  const accept = async (suggestion: Suggestion) => {
    // Execute the action
    await executeSuggestionAction(suggestion);
    dismiss(suggestion.id);
    apiPost('/api/suggestions/feedback', { suggestionId: suggestion.id, action: 'accepted' }).catch(() => {});
  };
  
  return { suggestions, loading, dismiss, accept, refresh: fetchSuggestions };
}

export async function executeSuggestionAction(suggestion: Suggestion) {
  if (!suggestion?.action) return;

  switch (suggestion.action.type) {
    case 'navigate':
      if (suggestion.action.destination) {
        window.open(`https://maps.google.com/?q=${encodeURIComponent(suggestion.action.destination)}`, '_blank');
      }
      break;
    case 'block_calendar':
      try {
        await apiPost('/api/calendar/events', {
          title: suggestion.action.title || 'Gym & Health Block',
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
          description: 'Auto-blocked proactive wellness session'
        });
      } catch (err) {
        console.warn('Calendar block fallback:', err);
      }
      break;
    case 'open_app':
      if (suggestion.action.app === 'nike') {
        window.open('https://www.nike.com', '_blank');
      } else if (suggestion.action.url) {
        window.open(suggestion.action.url, '_blank');
      }
      break;
    case 'summarize_inbox':
      try {
        await apiPost('/api/command', {
          message: 'Summarize my urgent unread emails',
          sessionId: 'proactive-session'
        });
      } catch (err) {
        console.warn('Inbox summary fallback:', err);
      }
      break;
    default:
      console.log(`[SuggestionAction] Executed generic action: ${suggestion.action.type}`);
  }
}

export default useSuggestions;
