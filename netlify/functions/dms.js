import { getUserFromEvent, json, parseBody } from "./_auth.js";
import { query } from "./_db.js";

export async function handler(event) {
  const user = getUserFromEvent(event);
  if (!user) return json(401, { error: "Nicht eingeloggt." });

  if (event.httpMethod === "GET") {
    const partner = event.queryStringParameters?.partner;
    if (!partner) return json(400, { error: "partner fehlt." });

    const result = await query(
      `SELECT dm.id, dm.content, dm.created_at, sender.username AS sender, receiver.username AS receiver
       FROM direct_messages dm
       JOIN users sender ON sender.id = dm.sender_id
       JOIN users receiver ON receiver.id = dm.receiver_id
       WHERE (sender.id = $1 AND receiver.username = $2)
          OR (receiver.id = $1 AND sender.username = $2)
       ORDER BY dm.created_at ASC`,
      [user.id, partner]
    );

    return json(200, result.rows);
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const { to, content } = parseBody(event);
  if (!to || !content?.trim()) return json(400, { error: "to und content sind erforderlich." });

  const receiver = await query("SELECT id FROM users WHERE username = $1", [to]);
  if (!receiver.rows.length) return json(404, { error: "Empfänger nicht gefunden." });

  await query("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)", [
    user.id,
    receiver.rows[0].id,
    content.trim()
  ]);

  return json(201, { success: true });
}
