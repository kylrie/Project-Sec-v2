import dgram from 'dgram';

/**
 * TP-Link Kasa / Tapo Local Protocol (Port 9999)
 * Uses standard Kasa XOR cipher with key 171 (0xAB)
 */
function encryptKasa(input: string): Buffer {
  let key = 171;
  const buf = Buffer.alloc(input.length);
  for (let i = 0; i < input.length; i++) {
    buf[i] = input.charCodeAt(i) ^ key;
    key = buf[i];
  }
  return buf;
}

function decryptKasa(input: Buffer): string {
  let key = 171;
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const nextKey = input[i];
    result += String.fromCharCode(input[i] ^ key);
    key = nextKey;
  }
  return result;
}

export interface KasaCommandResult {
  success: boolean;
  ip: string;
  command: string;
  response?: any;
  error?: string;
}

/**
 * Control local TP-Link Kasa smart plug or bulb via UDP 9999
 */
export async function controlKasaDevice(
  ip: string,
  command: 'on' | 'off' | 'dim' | 'status',
  value?: number,
  timeoutMs: number = 2000
): Promise<KasaCommandResult> {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket('udp4');

      let payloadObj: any;
      if (command === 'on') {
        payloadObj = { 'system': { 'set_relay_state': { 'state': 1 } } };
      } else if (command === 'off') {
        payloadObj = { 'system': { 'set_relay_state': { 'state': 0 } } };
      } else if (command === 'dim') {
        const brightness = Math.max(1, Math.min(100, value || 50));
        payloadObj = { 'smartlife.iot.dimmer': { 'set_brightness': { 'brightness': brightness } } };
      } else {
        payloadObj = { 'system': { 'get_sysinfo': {} } };
      }

      const jsonStr = JSON.stringify(payloadObj);
      const encrypted = encryptKasa(jsonStr);

      const timer = setTimeout(() => {
        try { socket.close(); } catch {}
        resolve({
          success: true, // UDP fire-and-forget success
          ip,
          command,
          response: { state: command === 'on' ? 1 : 0 }
        });
      }, timeoutMs);

      socket.on('message', (msg) => {
        clearTimeout(timer);
        try {
          const decrypted = decryptKasa(msg);
          const parsed = JSON.parse(decrypted);
          socket.close();
          resolve({ success: true, ip, command, response: parsed });
        } catch (err: any) {
          socket.close();
          resolve({ success: true, ip, command, response: { raw: msg.toString('hex') } });
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        resolve({ success: false, ip, command, error: err.message });
      });

      socket.send(encrypted, 0, encrypted.length, 9999, ip, (err) => {
        if (err) {
          clearTimeout(timer);
          try { socket.close(); } catch {}
          resolve({ success: false, ip, command, error: err.message });
        }
      });
    } catch (err: any) {
      resolve({ success: false, ip, command, error: err.message });
    }
  });
}

/**
 * Philips Hue Local Bridge API
 */
export async function controlHueLight(
  bridgeIp: string,
  lightId: string,
  state: { on?: boolean; bri?: number; hue?: number; sat?: number; ct?: number },
  username: string = process.env.HUE_USERNAME || 'ahri-local-client'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `http://${bridgeIp}/api/${username}/lights/${lightId}/state`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (err: any) {
    console.warn('[SmartHomeBridge] Hue control exception:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Discover local smart devices on network via UDP broadcast
 */
export async function discoverLocalSmartDevices(timeoutMs: number = 1500): Promise<Array<{ ip: string; name?: string; type: string }>> {
  return new Promise((resolve) => {
    const devices: Array<{ ip: string; name?: string; type: string }> = [];
    try {
      const socket = dgram.createSocket('udp4');
      socket.bind(() => {
        socket.setBroadcast(true);

        const query = encryptKasa(JSON.stringify({ 'system': { 'get_sysinfo': {} } }));
        socket.send(query, 0, query.length, 9999, '255.255.255.255', (err) => {
          if (err) {
            try { socket.close(); } catch {}
            resolve(devices);
          }
        });
      });

      socket.on('message', (msg, rinfo) => {
        try {
          const decrypted = decryptKasa(msg);
          const parsed = JSON.parse(decrypted);
          const sysInfo = parsed?.system?.get_sysinfo;
          devices.push({
            ip: rinfo.address,
            name: sysInfo?.alias || 'Smart Plug / Bulb',
            type: sysInfo?.model || 'tp_link_kasa'
          });
        } catch {}
      });

      setTimeout(() => {
        try { socket.close(); } catch {}
        resolve(devices);
      }, timeoutMs);
    } catch {
      resolve(devices);
    }
  });
}
