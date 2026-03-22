import { getUserFromEvent, json, parseBody } from "./_auth.js";
import { query } from "./_db.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const user = getUserFromEvent(event);
  if (!user) return json(401, { error: "Nicht eingeloggt." });

  const { postId, content } = parseBody(event);
  if (!postId || !content?.trim()) {
    return json(400, { error: "postId und content sind erforderlich." });
  }

  await query("INSERT INTO replies (post_id, author_id, content) VALUES ($1, $2, $3)", [postId, user.id, content.trim()]);
  return json(201, { success: true });
}
