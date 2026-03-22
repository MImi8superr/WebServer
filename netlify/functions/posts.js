import { getUserFromEvent, json, parseBody } from "./_auth.js";
import { query } from "./_db.js";

async function listPosts() {
  const result = await query(
    `SELECT
      p.id,
      p.content,
      p.created_at,
      u.username AS author,
      COUNT(*) FILTER (WHERE pr.reaction = 'like')::int AS likes,
      COUNT(*) FILTER (WHERE pr.reaction = 'dislike')::int AS dislikes
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN post_reactions pr ON pr.post_id = p.id
    GROUP BY p.id, u.username
    ORDER BY p.created_at DESC
    LIMIT 100`
  );

  const replies = await query(
    `SELECT r.id, r.post_id, r.content, r.created_at, u.username AS author
     FROM replies r
     JOIN users u ON u.id = r.author_id
     ORDER BY r.created_at ASC`
  );

  const groupedReplies = replies.rows.reduce((acc, row) => {
    if (!acc[row.post_id]) acc[row.post_id] = [];
    acc[row.post_id].push(row);
    return acc;
  }, {});

  return result.rows.map((post) => ({ ...post, replies: groupedReplies[post.id] || [] }));
}

export async function handler(event) {
  if (event.httpMethod === "GET") {
    const posts = await listPosts();
    return json(200, posts);
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const user = getUserFromEvent(event);
  if (!user) return json(401, { error: "Nicht eingeloggt." });

  const { content } = parseBody(event);
  if (!content?.trim()) return json(400, { error: "Post darf nicht leer sein." });

  await query("INSERT INTO posts (author_id, content) VALUES ($1, $2)", [user.id, content.trim()]);
  const posts = await listPosts();
  return json(201, posts);
}
