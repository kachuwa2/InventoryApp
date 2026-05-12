import { Request } from 'express';

// Safely extracts the client IP address from an Express v5
// request. Express v5 can return string | string[] for req.ip
// when requests pass through proxies or load balancers.
export function getIp(req: Request): string {
  const ip = req.ip;
  if (Array.isArray(ip)) return ip[0] || 'unknown';
  return ip || 'unknown';
}

// Safely extracts a URL parameter from an Express v5 request.
// Express v5 types req.params values as string | string[]
// even though in practice a named param like :id is always
// a single string. This helper narrows the type safely.
export function getParam(req: Request, key: string): string {
  const value = req.params[key];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}