import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.project.ahri',
  appName: 'Project Ahri',
  webDir: 'dist',
  server: {
    cleartext: true,
    // For dev testing on local network, uncomment and set your PC's IP:
    // url: 'http://192.168.1.X:3000',
    // androidScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#030712'
    }
  }
};

export default config;
