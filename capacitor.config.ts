import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.project.ahri',
  appName: 'Project Ahri',
  webDir: 'dist',
  server: {
    // In dev, allow loading from local network
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#030712'
    }
  }
};

export default config;
