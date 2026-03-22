import { query } from "./_db.js";
import { json, parseBody, signToken, verifyPassword } from "./_auth.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const { username, password } = parseBody(event);
  if (!username || !password) {
    return json(400, { error: "Username und Passwort sind erforderlich." });
  }

  const result = await query("SELECT id, username, password_hash FROM users WHERE username = $1", [username.trim()]);
  if (!result.rows.length) return json(401, { error: "Ungültige Login-Daten." });

  const user = result.rows[0];
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return json(401, { error: "Ungültige Login-Daten." });

  const token = signToken(user);
  return json(200, { token, user: { id: user.id, username: user.username } });
}
