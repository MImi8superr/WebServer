import { getUserFromEvent, json, parseBody } from "./_auth.js";
import { query } from "./_db.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const user = getUserFromEvent(event);
  if (!user) return json(401, { error: "Nicht eingeloggt." });

  const { postId, reaction } = parseBody(event);
  if (!postId || !["like", "dislike"].includes(reaction)) {
    return json(400, { error: "Ungültige Reaktion." });
  }

  await query(
    `INSERT INTO post_reactions (post_id, user_id, reaction)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id)
     DO UPDATE SET reaction = EXCLUDED.reaction`,
    [postId, user.id, reaction]
  );

  return json(200, { success: true });
}
