async function api(path, method = "GET", body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  return res.json();
}

async function loadPosts() {
  const posts = await api("/posts");
  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  posts.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";

    const date = new Date(p.createdAt).toLocaleString();

    div.innerHTML = `
      <div class="meta">ID: ${p._id} • ${date}</div>
      <div class="text">${escapeHtml(p.text)}</div>
      <div class="actions">
        <button class="action-btn" data-id="${p._id}" onclick="like('${p._id}')">👍 ${p.likes || 0}</button>
        <button class="action-btn" data-id="${p._id}" onclick="dislike('${p._1}')">👎 ${p.dislikes || 0}</button>
      </div>

      <div class="replies">
        ${ (p.replies || []).map(r => `<div>↳ ${escapeHtml(r.text)}</div>`).join("") }
      </div>

      <div class="reply-input">
        <input id="reply-${p._id}" placeholder="Antwort schreiben...">
        <button class="action-btn" onclick="reply('${p._id}')">Antworten</button>
      </div>
    `;
    feed.appendChild(div);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function like(id) {
  await api(`/post/${id}/like`, "POST");
  await loadPosts();
}
async function dislike(id) {
  await api(`/post/${id}/dislike`, "POST");
  await loadPosts();
}
async function reply(id) {
  const el = document.getElementById(`reply-${id}`);
  const text = el.value.trim();
  if (!text) return;
  el.value = "";
  await api(`/post/${id}/reply`, "POST", { text });
  await loadPosts();
}

document.getElementById("post-btn").addEventListener("click", async () => {
  const text = document.getElementById("post-text").value.trim();
  if (!text) return;
  document.getElementById("post-text").value = "";
  await api("/post", "POST", { text });
  await loadPosts();
});

// initial load
loadPosts();
