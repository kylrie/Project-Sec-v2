import { useState } from 'react';
import { apiPost } from '@/client/services/apiClient';
import { ActionIntent } from '@/client/components/ActionConfirmation';

export function useActionBroker() {
  const [pendingAction, setPendingAction] = useState<ActionIntent | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const processCommand = async (message: string) => {
    try {
      // Step 1: Parse intent
      const parseRes = await apiPost<{ intent: ActionIntent | null }>('/api/actions/parse', { message });
      const intent = parseRes?.intent;
      
      if (!intent || !intent.category) {
        return { success: false, requiresConfirmation: false };
      }
      
      // Step 2: Show confirmation
      setPendingAction(intent);
      setIsConfirming(true);
      
      return { success: true, intent, requiresConfirmation: true };
    } catch (err) {
      console.warn('[useActionBroker] parse exception:', err);
      return { success: false, requiresConfirmation: false };
    }
  };
  
  const confirmAction = async () => {
    if (!pendingAction) return;
    
    try {
      // Step 3: Execute
      const result = await apiPost<{ success: boolean; link?: string; spokenConfirmation?: string }>('/api/actions/execute', { intent: pendingAction });
      
      // Step 4: Open deep link if available
      if (result && result.link) {
        window.open(result.link, '_blank');
      }
      
      setIsConfirming(false);
      setPendingAction(null);
      
      return result;
    } catch (err) {
      console.error('[useActionBroker] execute exception:', err);
      setIsConfirming(false);
      setPendingAction(null);
    }
  };
  
  const cancelAction = () => {
    setIsConfirming(false);
    setPendingAction(null);
  };
  
  return {
    pendingAction,
    isConfirming,
    processCommand,
    confirmAction,
    cancelAction
  };
}

export default useActionBroker;
