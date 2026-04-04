/** Mask E.164 for display on shared screens (e.g. +1••••5678). */
export function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length <= 6) return p;
  return p.slice(0, 2) + "•".repeat(Math.min(p.length - 6, 8)) + p.slice(-4);
}
