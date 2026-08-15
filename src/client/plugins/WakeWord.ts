import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

export interface WakeWordPlugin {
  initialize(options: { accessKey: string; keywordPath?: string }): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  addListener(
    eventName: 'wakeWordEvent',
    listenerFunc: (data: { event: string; transcript?: string; code?: number }) => void
  ): Promise<PluginListenerHandle>;
}

const WakeWordNative = registerPlugin<WakeWordPlugin>('WakeWord', {
  web: () => ({
    initialize: async () => {},
    startListening: async () => {},
    stopListening: async () => {},
    addListener: async () => ({
      remove: async () => {}
    })
  })
});

export const WakeWord = {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async initialize(accessKey: string, keywordPath?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await WakeWordNative.initialize({ accessKey, keywordPath });
      return true;
    } catch (e) {
      console.warn('[WakeWord Native] Initialize error:', e);
      return false;
    }
  },

  async startListening(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await WakeWordNative.startListening();
      return true;
    } catch (e) {
      console.warn('[WakeWord Native] startListening error:', e);
      return false;
    }
  },

  async stopListening(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await WakeWordNative.stopListening();
      return true;
    } catch (e) {
      console.warn('[WakeWord Native] stopListening error:', e);
      return false;
    }
  },

  async addListener(
    listenerFunc: (data: { event: string; transcript?: string; code?: number }) => void
  ): Promise<PluginListenerHandle | null> {
    if (!this.isAvailable()) return null;
    try {
      return await WakeWordNative.addListener('wakeWordEvent', listenerFunc);
    } catch (e) {
      console.warn('[WakeWord Native] addListener error:', e);
      return null;
    }
  }
};
