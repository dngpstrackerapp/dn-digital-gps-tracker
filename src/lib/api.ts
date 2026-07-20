export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  try {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && (origin.startsWith('http://') || origin.startsWith('https://'))) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${origin}${cleanPath}`;
    }
  } catch (e) {
    console.error('[API Utils] Error resolving absolute API URL:', e);
  }
  return path;
}

export async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, options);
}
