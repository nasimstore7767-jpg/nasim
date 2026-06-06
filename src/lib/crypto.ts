const SALT = 'erp::yer::v1::';
export async function hashPassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + plain);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return (await hashPassword(plain)) === hash;
}
