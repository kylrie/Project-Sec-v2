import { registerPlugin, Capacitor } from '@capacitor/core';

export interface OverlayPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  showBubble(): Promise<{ success: boolean }>;
  hideBubble(): Promise<{ success: boolean }>;
  isBubbleVisible(): Promise<{ visible: boolean; hasPermission?: boolean }>;
}

const OverlayNative = registerPlugin<OverlayPlugin>('Overlay', {
  web: () => ({
    checkPermission: async () => ({ granted: false }),
    requestPermission: async () => {},
    showBubble: async () => ({ success: false }),
    hideBubble: async () => ({ success: false }),
    isBubbleVisible: async () => ({ visible: false, hasPermission: false }),
  })
});

export const Overlay = {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async checkPermission(): Promise<{ granted: boolean }> {
    if (!this.isAvailable()) return { granted: false };
    try {
      return await OverlayNative.checkPermission();
    } catch {
      return { granted: false };
    }
  },

  async requestPermission(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await OverlayNative.requestPermission();
    } catch (e) {
      console.warn('Overlay permission request error:', e);
    }
  },

  async showBubble(): Promise<{ success: boolean }> {
    if (!this.isAvailable()) return { success: false };
    try {
      return await OverlayNative.showBubble();
    } catch (e) {
      console.warn('Overlay showBubble error:', e);
      return { success: false };
    }
  },

  async hideBubble(): Promise<{ success: boolean }> {
    if (!this.isAvailable()) return { success: false };
    try {
      return await OverlayNative.hideBubble();
    } catch (e) {
      console.warn('Overlay hideBubble error:', e);
      return { success: false };
    }
  },

  async isBubbleVisible(): Promise<{ visible: boolean; hasPermission?: boolean }> {
    if (!this.isAvailable()) return { visible: false, hasPermission: false };
    try {
      return await OverlayNative.isBubbleVisible();
    } catch {
      return { visible: false, hasPermission: false };
    }
  }
};
