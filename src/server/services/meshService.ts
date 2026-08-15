import { WebSocket } from 'ws';

// Map: userId -> Map<deviceName, WebSocket>
const meshRegistry = new Map<string, Map<string, WebSocket>>();

export function registerDeviceWs(userId: string, deviceName: string, ws: WebSocket) {
  if (!meshRegistry.has(userId)) meshRegistry.set(userId, new Map());
  meshRegistry.get(userId)!.set(deviceName, ws);
  console.log(`[MeshService] Registered device '${deviceName}' for user '${userId}'`);
}

export function unregisterDeviceWs(userId: string, deviceName: string) {
  meshRegistry.get(userId)?.delete(deviceName);
  console.log(`[MeshService] Unregistered device '${deviceName}' for user '${userId}'`);
}

export function getConnectedDevices(userId: string): string[] {
  const userMesh = meshRegistry.get(userId);
  if (!userMesh) return [];
  const openDevices: string[] = [];
  userMesh.forEach((ws, name) => {
    if (ws.readyState === WebSocket.OPEN) {
      openDevices.push(name);
    }
  });
  return openDevices;
}

export function broadcastToDevice(userId: string, targetDevice: string, payload: any): boolean {
  const userMesh = meshRegistry.get(userId);
  if (!userMesh) return false;
  
  const ws = userMesh.get(targetDevice);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  
  ws.send(JSON.stringify({
    type: 'DEVICE_COMMAND',
    timestamp: Date.now(),
    targetDevice,
    ...payload
  }));
  return true;
}

export function broadcastToAllDevices(userId: string, payload: any): number {
  const userMesh = meshRegistry.get(userId);
  if (!userMesh) return 0;
  
  let sentCount = 0;
  userMesh.forEach((ws, name) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'DEVICE_BROADCAST',
        timestamp: Date.now(),
        targetDevice: name,
        ...payload
      }));
      sentCount++;
    }
  });
  return sentCount;
}
