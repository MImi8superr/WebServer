const api = "https://buzzup.onrender.com";
let token = localStorage.getItem("token");

// Registrierung
async function register() {
  const username = document.getElementById("regUser").value;
  const password = document.getElementById("regPass").value;

  const res = await fetch(api + "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  alert(data.success ? "Account erstellt!" : data.error);
}

// Login
async function login() {
  const username = document.getElementById("logUser").value;
  const password = document.getElementById("logPass").value;

  const res = await fetch(api + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    token = data.token;
    alert("Login erfolgreich!");
  } else {
    alert(data.error);
  }
}

async function loadPosts() {
  const res = await fetch(api + "/posts");
  const posts = await res.json();

  const box = document.getElementById("posts");
  box.innerHTML = "";

  posts.forEach(post => {
    box.innerHTML += `
      <div class="post">
        <b>${post.author}</b><br>
        ${post.content}<br><br>

        <button onclick="react('${post._id}', 'like')">👍 ${post.likes}</button>
        <button onclick="react('${post._id}', 'dislike')">👎 ${post.dislikes}</button>
      </div>
      <hr>
    `;
  });
}

async function createPost() {
  if (!token) return alert("Du musst eingeloggt sein!");

  const content = document.getElementById("content").value;

  const res = await fetch(api + "/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ content })
  });

  document.getElementById("content").value = "";
  loadPosts();
}

// Likes
async function react(id, action) {
  await fetch(api + "/posts/react", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: id, action })
  });

  loadPosts();
}

loadPosts();
