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
  socket.on("post:deleted", ({ id }) => removePost(id));
}

function getUserReaction(post) {
  if (!currentUser || !post.reactions) return null;
  if (post.reactions instanceof Map) {
    return post.reactions.get(currentUser) || null;
  }
  return post.reactions[currentUser] || null;
}

function applyReactionState(wrapper, post) {
  const likeBtn = wrapper.querySelector('.action-btn[data-action="like"]');
  const dislikeBtn = wrapper.querySelector('.action-btn[data-action="dislike"]');
  const reaction = getUserReaction(post);

  likeBtn?.classList.toggle("is-active", reaction === "like");
  dislikeBtn?.classList.toggle("is-active", reaction === "dislike");
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

  const header = document.createElement("div");
  header.className = "post-header";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = post.author;
  header.appendChild(meta);

  if (currentUser === post.author) {
    const menu = document.createElement("div");
    menu.className = "post-menu";
    const closeMenu = () => menu.classList.remove("open");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "menu-trigger";
    trigger.setAttribute("aria-label", "Post-Aktionen");
    trigger.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Bearbeiten";
    editBtn.addEventListener("click", () => {
      closeMenu();
      enterEditMode(wrapper, post);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Löschen";
    deleteBtn.addEventListener("click", () => {
      closeMenu();
      deletePost(post._id);
    });

    dropdown.append(editBtn, deleteBtn);
    menu.append(trigger, dropdown);
    trigger.addEventListener("click", () => menu.classList.toggle("open"));
    header.appendChild(menu);
  }

  const content = document.createElement("p");
  content.className = "content";
  content.textContent = post.content;

  const actions = document.createElement("div");
  actions.className = "actions";
  const likeBtn = createReactionButton("like", post.likes, post._id);
  const dislikeBtn = createReactionButton("dislike", post.dislikes, post._id);
  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "action-btn";
  replyBtn.textContent = "💬 Antworten";
  replyBtn.addEventListener("click", () => toggleReplyForm(wrapper, post._id));
  actions.append(likeBtn, dislikeBtn, replyBtn);

  const replyFormContainer = document.createElement("div");
  replyFormContainer.className = "reply-form-container";

  const replies = document.createElement("div");
  replies.className = "replies";
  renderReplies(post, replies);

  wrapper.append(header, content, actions, replyFormContainer, replies);
  applyReactionState(wrapper, post);

  return wrapper;
}

function upsertPost(post) {
  const container = document.getElementById("posts");
  if (!container) return;

  const existing = container.querySelector(`[data-id="${post._id}"]`);

  if (existing) {
    const updated = createPostElement(post);
    container.replaceChild(updated, existing);
    return;
  }

  const element = createPostElement(post);
  container.prepend(element);
}

function renderReplies(post, container) {
  container.innerHTML = "";
  if (!post.replies?.length) return;

  const headline = document.createElement("p");
  headline.className = "replies-title";
  headline.textContent = "Antworten";
  container.appendChild(headline);

  post.replies.forEach((reply) => {
    const entry = document.createElement("div");
    entry.className = "reply";

    const byline = document.createElement("p");
    byline.className = "reply-meta";
    byline.textContent = reply.author;

    const text = document.createElement("p");
    text.className = "reply-text";
    text.textContent = reply.content;

    entry.append(byline, text);
    container.appendChild(entry);
  });
}

function enterEditMode(wrapper, post) {
  if (!token) return redirectToAuth();
  if (wrapper.dataset.editing === "true") return;
  wrapper.dataset.editing = "true";

  const contentEl = wrapper.querySelector(".content");
  const actionsEl = wrapper.querySelector(".actions");
  if (!contentEl || !actionsEl) return;

  const textarea = document.createElement("textarea");
  textarea.className = "edit-area";
  textarea.value = post.content;
  textarea.setAttribute("aria-label", "Post bearbeiten");
  contentEl.replaceWith(textarea);

  const editActions = document.createElement("div");
  editActions.className = "edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn primary small";
  saveBtn.textContent = "Speichern";
  saveBtn.addEventListener("click", () => updatePost(post._id, textarea.value));

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn ghost small";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", () => {
    textarea.replaceWith(contentEl);
    editActions.remove();
    wrapper.dataset.editing = "false";
  });

  editActions.append(saveBtn, cancelBtn);
  wrapper.insertBefore(editActions, actionsEl);
}

async function updatePost(id, content) {
  if (!token) return redirectToAuth();
  const trimmed = content.trim();
  if (!trimmed) return alert("Der Post-Inhalt darf nicht leer sein.");

  try {
    const res = await fetch(`${apiBase}/posts/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ content: trimmed })
    });

    if (res.status === 401) {
      setSession(null);
      return redirectToAuth();
    }

    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }

    upsertPost(data);
  } catch {
    alert("Der Post konnte nicht bearbeitet werden.");
  }
}

async function deletePost(id) {
  if (!token) return redirectToAuth();
  const confirmDelete = confirm("Möchtest du diesen Post wirklich löschen?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`${apiBase}/posts/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) {
      setSession(null);
      return redirectToAuth();
    }

    const data = await res.json();
    if (data.error) return alert(data.error);
    removePost(id);
  } catch {
    alert("Der Post konnte nicht gelöscht werden.");
  }
}

function toggleReplyForm(wrapper, postId) {
  if (!token) return redirectToAuth();

  const container = wrapper.querySelector(".reply-form-container");
  if (!container) return;

  if (container.childElementCount) {
    container.innerHTML = "";
    return;
  }

  const form = document.createElement("form");
  form.className = "reply-form";

  const textarea = document.createElement("textarea");
  textarea.className = "reply-area";
  textarea.placeholder = "Antwort schreiben...";

  const buttons = document.createElement("div");
  buttons.className = "reply-actions";

  const sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.className = "btn primary small";
  sendBtn.textContent = "Absenden";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn ghost small";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", () => (container.innerHTML = ""));

  buttons.append(sendBtn, cancelBtn);
  form.append(textarea, buttons);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitReply(postId, textarea.value, container);
  });

  container.appendChild(form);
}

async function submitReply(postId, content, container) {
  if (!token) return redirectToAuth();
  const trimmed = content.trim();
  if (!trimmed) return alert("Bitte gib eine Antwort ein.");

  try {
    const res = await fetch(`${apiBase}/posts/${postId}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ content: trimmed })
    });

    if (res.status === 401) {
      setSession(null);
      return redirectToAuth();
    }

    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }

    container.innerHTML = "";
    upsertPost(data);
  } catch {
    alert("Antwort konnte nicht gesendet werden.");
  }
}

function removePost(id) {
  const container = document.getElementById("posts");
  const postEl = container?.querySelector(`[data-id="${id}"]`);
  postEl?.remove();
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
