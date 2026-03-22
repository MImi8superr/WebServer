import { getUserFromEvent, json } from "./_auth.js";
import { query } from "./_db.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const user = getUserFromEvent(event);
  if (!user) return json(401, { error: "Nicht eingeloggt." });

  const result = await query("SELECT username FROM users WHERE id <> $1 ORDER BY username ASC", [user.id]);
  return json(200, result.rows.map((row) => row.username));
}
