const authStatus = document.getElementById("authStatus");
const authForm = document.getElementById("authForm");
const logoutBtn = document.getElementById("logoutBtn");
const postForm = document.getElementById("postForm");
const postContent = document.getElementById("postContent");
const postsEl = document.getElementById("posts");
const dmUserSelect = document.getElementById("dmUserSelect");
const dmMessages = document.getElementById("dmMessages");
const dmForm = document.getElementById("dmForm");
const dmContent = document.getElementById("dmContent");

let auth = JSON.parse(localStorage.getItem("auth") || "null");
let activeDmPartner = "";

function setAuth(nextAuth) {
  auth = nextAuth;
  if (nextAuth) {
    localStorage.setItem("auth", JSON.stringify(nextAuth));
    authStatus.textContent = `Eingeloggt als ${nextAuth.user.username}`;
  } else {
    localStorage.removeItem("auth");
    authStatus.textContent = "Nicht eingeloggt";
  }
}

function authHeaders() {
  return auth ? { Authorization: `Bearer ${auth.token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Fehler");
  return data;
}

async function loadPosts() {
  const posts = await api("posts", { method: "GET", headers: {} });
  postsEl.innerHTML = "";

  posts.forEach((post) => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <div class="meta">${post.author} · ${new Date(post.created_at).toLocaleString()}</div>
      <div>${post.content}</div>
      <div class="row">
        <button data-react="like">👍 ${post.likes}</button>
        <button data-react="dislike">👎 ${post.dislikes}</button>
      </div>
      <form class="replyForm row">
        <input name="content" placeholder="Antwort schreiben" />
        <button type="submit">Antworten</button>
      </form>
      <div class="replies">
        ${post.replies.map((r) => `<div class="reply"><b>${r.author}:</b> ${r.content}</div>`).join("")}
      </div>
    `;

    div.querySelectorAll("button[data-react]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!auth) return alert("Bitte einloggen");
        await api("react", {
          method: "POST",
          body: JSON.stringify({ postId: post.id, reaction: btn.dataset.react })
        });
        await loadPosts();
      });
    });

    div.querySelector(".replyForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!auth) return alert("Bitte einloggen");
      const content = event.target.content.value.trim();
      if (!content) return;
      await api("replies", { method: "POST", body: JSON.stringify({ postId: post.id, content }) });
      event.target.reset();
      await loadPosts();
    });

    postsEl.appendChild(div);
  });
}

async function loadUsers() {
  if (!auth) return;
  const users = await api("users", { method: "GET", headers: {} });
  dmUserSelect.innerHTML = '<option value="">-- User auswählen --</option>';
  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    dmUserSelect.appendChild(option);
  });
}

async function loadDms() {
  if (!auth || !activeDmPartner) {
    dmMessages.innerHTML = "";
    return;
  }

  const dms = await api(`dms?partner=${encodeURIComponent(activeDmPartner)}`, { method: "GET", headers: {} });
  dmMessages.innerHTML = dms
    .map((msg) => {
      const mine = msg.sender === auth.user.username;
      return `<div class="msg ${mine ? "me" : ""}"><b>${msg.sender}</b>: ${msg.content}</div>`;
    })
    .join("");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const result = await api("signup", { method: "POST", body: JSON.stringify({ username, password }) });
    setAuth(result);
    await Promise.all([loadUsers(), loadPosts()]);
  } catch (error) {
    alert(error.message);
  }
});

authForm.querySelector("button[data-action='login']").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  try {
    const result = await api("login", { method: "POST", body: JSON.stringify({ username, password }) });
    setAuth(result);
    await Promise.all([loadUsers(), loadPosts()]);
  } catch (error) {
    alert(error.message);
  }
});

logoutBtn.addEventListener("click", () => {
  setAuth(null);
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return alert("Bitte einloggen");
  const content = postContent.value.trim();
  if (!content) return;
  await api("posts", { method: "POST", body: JSON.stringify({ content }) });
  postForm.reset();
  await loadPosts();
});

dmUserSelect.addEventListener("change", async () => {
  activeDmPartner = dmUserSelect.value;
  await loadDms();
});

dmForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return alert("Bitte einloggen");
  if (!activeDmPartner) return alert("Bitte zuerst einen User auswählen.");

  const content = dmContent.value.trim();
  if (!content) return;

  await api("dms", { method: "POST", body: JSON.stringify({ to: activeDmPartner, content }) });
  dmForm.reset();
  await loadDms();
});

setAuth(auth);
loadPosts();
if (auth) {
  loadUsers();
}

setInterval(async () => {
  try {
    await loadPosts();
    await loadDms();
  } catch {
    // polling silent
  }
}, 4000);
