import { query } from "./_db.js";
import { hashPassword, json, parseBody, signToken } from "./_auth.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const { username, password } = parseBody(event);
  if (!username || !password || password.length < 4) {
    return json(400, { error: "Username und Passwort (mind. 4 Zeichen) sind erforderlich." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username.trim(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    return json(201, { token, user });
  } catch (error) {
    if (error.code === "23505") {
      return json(409, { error: "Username ist bereits vergeben." });
    }
    return json(500, { error: "Signup fehlgeschlagen." });
  }
}
