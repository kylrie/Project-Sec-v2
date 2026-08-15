/**
 * Unified API Client for Project Ahri
 */

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

export async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API POST ${endpoint} failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API GET ${endpoint} failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export default {
  apiPost,
  apiGet,
};
