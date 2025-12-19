const apiBase = window.location.origin;
let token = localStorage.getItem("token");
let socket;
let currentUser = null;

function decodeUsernameFromToken(jwtToken) {
  try {
    const payload = JSON.parse(atob(jwtToken.split(".")[1]));
    return payload?.username || null;
  } catch {
    return null;
  }
}

function setSession(newToken) {
  if (newToken) {
    const username = decodeUsernameFromToken(newToken);
    if (!username) {
      localStorage.removeItem("token");
      token = null;
      currentUser = null;
    } else {
      token = newToken;
      currentUser = username;
      localStorage.setItem("token", newToken);
    }
  } else {
    token = null;
    currentUser = null;
    localStorage.removeItem("token");
  }

  renderUserStatus();
  togglePostAvailability();
  refreshAllReactions();
}

function renderUserStatus() {
  const statusEl = document.getElementById("userStatus");
  if (!statusEl) return;

  if (currentUser) {
    statusEl.textContent = `Eingeloggt als ${currentUser}`;
    statusEl.classList.remove("muted");
  } else {
    statusEl.textContent = "Nicht eingeloggt";
    statusEl.classList.add("muted");
  }
}

function togglePostAvailability() {
  const textarea = document.getElementById("content");
  const postButton = document.getElementById("post-btn");
  const helper = document.getElementById("postHelper");

  if (!textarea || !postButton) return;

  const disabled = !token;
  textarea.disabled = disabled;
  postButton.disabled = disabled;

  if (helper) {
    helper.textContent = disabled ? "Melde dich an, um zu posten." : "Was beschäftigt dich?";
  }
}

function initSocket() {
  socket = io(apiBase, { transports: ["websocket", "polling"] });

  socket.on("post:created", (post) => upsertPost(post));
  socket.on("post:updated", (post) => upsertPost(post));
}

function getUserReaction(post) {
  if (!currentUser || !post.reactions) return null;
  if (post.reactions instanceof Map) {
    return post.reactions.get(currentUser) || null;
  }
  return post.reactions[currentUser] || null;
}

function applyReactionState(wrapper, post) {
  const [likeBtn, dislikeBtn] = wrapper.querySelectorAll(".action-btn");
  const reaction = getUserReaction(post);

  if (likeBtn && dislikeBtn) {
    likeBtn.classList.toggle("is-active", reaction === "like");
    dislikeBtn.classList.toggle("is-active", reaction === "dislike");
  }
}

function createReactionButton(action, count, postId) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "action-btn";
  btn.dataset.action = action;
  btn.textContent = `${action === "like" ? "👍" : "👎"} ${count}`;
  btn.addEventListener("click", () => react(postId, action));
  return btn;
}

function createPostElement(post) {
  const wrapper = document.createElement("article");
  wrapper.className = "post";
  wrapper.dataset.id = post._id;
  wrapper.__post = post;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = post.author;

  const content = document.createElement("p");
  content.className = "content";
  content.textContent = post.content;

  const actions = document.createElement("div");
  actions.className = "actions";
  const likeBtn = createReactionButton("like", post.likes, post._id);
  const dislikeBtn = createReactionButton("dislike", post.dislikes, post._id);
  actions.append(likeBtn, dislikeBtn);

  wrapper.append(meta, content, actions);
  applyReactionState(wrapper, post);

  return wrapper;
}

function upsertPost(post) {
  const container = document.getElementById("posts");
  if (!container) return;

  const existing = container.querySelector(`[data-id="${post._id}"]`);

  if (existing) {
    existing.__post = post;
    existing.querySelector(".content").textContent = post.content;
    const [likeBtn, dislikeBtn] = existing.querySelectorAll(".action-btn");
    if (likeBtn && dislikeBtn) {
      likeBtn.textContent = `👍 ${post.likes}`;
      dislikeBtn.textContent = `👎 ${post.dislikes}`;
    }
    applyReactionState(existing, post);
    return;
  }

  const element = createPostElement(post);
  container.prepend(element);
}

async function register(event) {
  event?.preventDefault();
  const username = document.getElementById("regUser")?.value.trim();
  const password = document.getElementById("regPass")?.value;
  const messageEl = document.getElementById("registerMessage");

  if (!username || !password) return;

  try {
    const res = await fetch(apiBase + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      event?.target?.reset?.();
      if (messageEl) {
        messageEl.textContent = "Account erstellt! Du kannst dich jetzt einloggen.";
        messageEl.className = "form-message success";
      }
    } else {
      if (messageEl) {
        messageEl.textContent = data.error || "Registrierung fehlgeschlagen.";
        messageEl.className = "form-message error";
      }
    }
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = "Server nicht erreichbar. Bitte erneut versuchen.";
      messageEl.className = "form-message error";
    }
  }
}

async function login(event) {
  event?.preventDefault();
  const username = document.getElementById("logUser")?.value.trim();
  const password = document.getElementById("logPass")?.value;
  const messageEl = document.getElementById("loginMessage");

  if (!username || !password) return;

  try {
    const res = await fetch(apiBase + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.token) {
      setSession(data.token);
      if (messageEl) {
        messageEl.textContent = "Login erfolgreich!";
        messageEl.className = "form-message success";
      }
      window.location.href = "/";
    } else if (messageEl) {
      messageEl.textContent = data.error || "Login fehlgeschlagen.";
      messageEl.className = "form-message error";
    }
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = "Server nicht erreichbar. Bitte erneut versuchen.";
      messageEl.className = "form-message error";
    }
  }
}

async function loadPosts() {
  try {
    const res = await fetch(apiBase + "/posts");
    const posts = await res.json();

    const container = document.getElementById("posts");
    if (!container) return;

    container.innerHTML = "";
    posts.forEach((post) => container.appendChild(createPostElement(post)));
  } catch {
    alert("Beiträge konnten nicht geladen werden.");
  }
}

async function createPost() {
  if (!token) return redirectToAuth();

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

async function react(id, action) {
  const postEl = document.querySelector(`[data-id="${id}"]`);
  const postData = postEl?.__post;
  if (postData && getUserReaction(postData) === action) return;

  if (!token) return redirectToAuth();

  try {
    const res = await fetch(apiBase + "/posts/react", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ postId: id, action })
    });

    if (res.status === 401) {
      setSession(null);
      return redirectToAuth();
    }

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

function redirectToAuth() {
  alert("Bitte melde dich zuerst an.");
  window.location.href = "/auth.html#login";
}

function refreshAllReactions() {
  const container = document.getElementById("posts");
  if (!container) return;

  container.querySelectorAll(".post").forEach((postEl) => {
    const data = postEl.__post;
    if (data) applyReactionState(postEl, data);
  });
}

function setupPostForm() {
  const form = document.getElementById("new-post-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    createPost();
  });
}

function setupAuthForms() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  loginForm?.addEventListener("submit", login);
  registerForm?.addEventListener("submit", register);
}

function bootstrap() {
  if (token) {
    const username = decodeUsernameFromToken(token);
    if (username) {
      currentUser = username;
    } else {
      token = null;
      localStorage.removeItem("token");
    }
  }

  renderUserStatus();
  togglePostAvailability();
  setupAuthForms();

  const hasPosts = Boolean(document.getElementById("posts"));
  if (hasPosts) {
    setupPostForm();
    initSocket();
    loadPosts();
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
