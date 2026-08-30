// Server-side (SSR) fetches run INSIDE the Docker network and must use the
// backend SERVICE NAME — resolvable between containers only.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Browser-side URLs (download links, Swagger link) are opened by the USER's
// browser, which is OUTSIDE the Docker network — it must reach the backend via
// a host-published address (localhost), never a Docker service name.
const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_API_BROWSER_URL || API_URL;

export const API_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, '');
export const API_BROWSER_BASE_URL = BROWSER_API_URL.replace(/\/api\/v1\/?$/, '');

import { Partner, Activity, DocumentItem } from '@/types/api';

export async function getPartners(): Promise<Partner[]> {
  const res = await fetch(`${API_URL}/partners/`, {
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch partners');
  }
  
  return res.json();
}

export async function getPartner(id: number): Promise<Partner> {
  const res = await fetch(`${API_URL}/partners/${id}`, {
    cache: 'no-store',
  });
  
  if (res.status === 404) {
    throw new Error('Partner not found');
  }
  
  if (!res.ok) {
    throw new Error('Failed to fetch partner');
  }
  
  return res.json();
}

export async function getActivities(): Promise<Activity[]> {
  const res = await fetch(`${API_URL}/activities/`, {
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch activities');
  }
  
  return res.json();
}

export async function getActivity(id: number): Promise<Activity> {
  const res = await fetch(`${API_URL}/activities/${id}`, {
    cache: 'no-store',
  });
  
  if (res.status === 404) {
    throw new Error('Activity not found');
  }
  
  if (!res.ok) {
    throw new Error('Failed to fetch activity');
  }
  
  return res.json();
}

export async function getDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_URL}/documents/`, {
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch documents');
  }
  
  return res.json();
}

export function documentDownloadUrl(id: number): string {
  // Browser opens this link directly → use the browser-reachable base URL.
  return `${BROWSER_API_URL}/documents/${id}/download`;
}
