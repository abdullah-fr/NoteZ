/**
 * Only allow relative in-app destinations to come back through auth.
 * This prevents a checkout/login query parameter from becoming an open
 * redirect while still preserving paths such as /pricing?checkout=pro_yearly.
 */
export function getSafeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

