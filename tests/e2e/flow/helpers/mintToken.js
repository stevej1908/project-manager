/**
 * Mint an HS256 JWT the backend will accept, without pulling in jsonwebtoken.
 * The server verifies with jwt.verify(token, JWT_SECRET) (default HS256), so a
 * standard {alg:HS256,typ:JWT} token signed with the same secret validates.
 */
const crypto = require('crypto');

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** payload: { id, email, name }. Mirrors the server's 7-day token. */
function mint(payload, secret, expiresInSeconds = 7 * 24 * 3600) {
  if (!secret) throw new Error('mint(): a JWT secret is required');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const data = `${header}.${body}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

module.exports = { mint };
