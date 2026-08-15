import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface WakeWordPlugin {
  initialize(options: { accessKey: string; keywordPath?: string }): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  addListener(
    eventName: 'wakeWordEvent',
    listenerFunc: (event: WakeWordEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface WakeWordEvent {
  event: 'wake_word_detected' | 'listening_started' | 'transcript_ready' | 'error';
  transcript?: string;
  code?: number;
}

export const WakeWord = registerPlugin<WakeWordPlugin>('WakeWord', {
  web: () => ({
    initialize: async () => {},
    startListening: async () => {},
    stopListening: async () => {},
    addListener: async () => ({
      remove: async () => {}
    })
  })
});

export default WakeWord;
