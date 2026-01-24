import type { AuthUserContext, AuthUserRole } from '../types/auth-user-context';
import { validate as uuidValidate } from 'uuid';

const DEV_TOKEN_PREFIX = 'DEV';
const DEV_TOKEN_VERSION = 'v1';
const DEV_TOKEN_ROLES: AuthUserRole[] = ['ADMIN', 'AGENT'];

export function parseDevToken(rawToken: string): AuthUserContext {
  const parts = rawToken.split('.');

  // Find all candidate starts: "DEV.v1"
  const candidateStarts: number[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === DEV_TOKEN_PREFIX && parts[i + 1] === DEV_TOKEN_VERSION) {
      candidateStarts.push(i);
    }
  }

  // Prefer the LAST valid candidate (fits your concatenated token example)
  for (let c = candidateStarts.length - 1; c >= 0; c--) {
    const i = candidateStarts[c];

    // Need 6 contiguous parts: DEV, v1, tenantId, userId, role, timestamp
    if (i + 5 >= parts.length) continue;

    const prefix = parts[i];
    const version = parts[i + 1];
    const tenantId = parts[i + 2];
    const userId = parts[i + 3];
    const role = parts[i + 4];
    const timestamp = parts[i + 5];

    if (prefix !== DEV_TOKEN_PREFIX || version !== DEV_TOKEN_VERSION) continue;
    if (!uuidValidate(tenantId)) continue;
    if (!uuidValidate(userId)) continue;
    if (!DEV_TOKEN_ROLES.includes(role as AuthUserRole)) continue;

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt)) continue;

    return {
      tenantId,
      userId,
      role: role as AuthUserRole,
    };
  }

  throw new Error('Invalid dev token format');
}

