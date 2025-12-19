const apiBase = window.location.origin;
let token = localStorage.getItem("token");
let socket;

function initSocket() {
  socket = io(apiBase, { transports: ["websocket", "polling"] });

  socket.on("post:created", (post) => {
    upsertPost(post);
  });

  socket.on("post:updated", (post) => {
    upsertPost(post);
  });
}

function createPostElement(post) {
  const wrapper = document.createElement("div");
  wrapper.className = "post";
  wrapper.dataset.id = post._id;

  const author = document.createElement("b");
  author.textContent = post.author;

  const content = document.createElement("div");
  content.textContent = post.content;

  const actions = document.createElement("div");
  const likeBtn = document.createElement("button");
  likeBtn.textContent = `👍 ${post.likes}`;
  likeBtn.addEventListener("click", () => react(post._id, "like"));

  const dislikeBtn = document.createElement("button");
  dislikeBtn.textContent = `👎 ${post.dislikes}`;
  dislikeBtn.addEventListener("click", () => react(post._id, "dislike"));

  actions.append(likeBtn, dislikeBtn);
  wrapper.append(author, document.createElement("br"), content, document.createElement("br"), document.createElement("br"), actions, document.createElement("hr"));

  return wrapper;
}

function upsertPost(post) {
  const container = document.getElementById("posts");
  if (!container) return;

  const existing = container.querySelector(`[data-id="${post._id}"]`);

  if (existing) {
    existing.querySelector("div").textContent = post.content;
    const [likeBtn, dislikeBtn] = existing.querySelectorAll("button");
    likeBtn.textContent = `👍 ${post.likes}`;
    dislikeBtn.textContent = `👎 ${post.dislikes}`;
    return;
  }

  const element = createPostElement(post);
  container.prepend(element);
}

// Registrierung
async function register() {
  const usernameInput = document.getElementById("regUser");
  const passwordInput = document.getElementById("regPass");
  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await fetch(apiBase + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    alert(data.success ? "Account erstellt!" : data.error || "Registrierung fehlgeschlagen.");
  } catch (error) {
    alert("Server nicht erreichbar. Bitte erneut versuchen.");
  }
}

// Login
async function login() {
  const usernameInput = document.getElementById("logUser");
  const passwordInput = document.getElementById("logPass");
  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await fetch(apiBase + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      token = data.token;
      alert("Login erfolgreich!");
      window.location.href = "/";
    } else {
      alert(data.error || "Login fehlgeschlagen.");
    }
  } catch (error) {
    alert("Server nicht erreichbar. Bitte erneut versuchen.");
  }
}

async function loadPosts() {
  const container = document.getElementById("posts");
  if (!container) return;

  try {
    const res = await fetch(apiBase + "/posts");
    const posts = await res.json();

    container.innerHTML = "";
    posts.forEach((post) => container.appendChild(createPostElement(post)));
  } catch (error) {
    alert("Beiträge konnten nicht geladen werden.");
  }
}

async function createPost() {
  if (!token) return alert("Du musst eingeloggt sein!");

  const contentField = document.getElementById("content");
  const content = contentField.value.trim();
  if (!content) return alert("Bitte Text eingeben.");

  try {
    const res = await fetch(apiBase + "/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ content })
    });

    const post = await res.json();
    if (post.error) {
      return alert(post.error);
    }

    contentField.value = "";
    upsertPost(post);
  } catch (error) {
    alert("Post konnte nicht erstellt werden.");
  }
}

// Likes
async function react(id, action) {
  if (!token) return alert("Bitte zuerst einloggen.");

  try {
    const res = await fetch(apiBase + "/posts/react", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ postId: id, action })
    });

    const post = await res.json();
    if (!post.error) {
      upsertPost(post);
    } else {
      alert(post.error);
    }
  } catch (error) {
    alert("Aktion fehlgeschlagen.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("posts")) {
    initSocket();
    loadPosts();
  }
});
