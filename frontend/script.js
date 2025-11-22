const api = "http://localhost:3000";
const postContainer = document.getElementById("posts");
const form = document.getElementById("postForm");
const usernameInput = document.getElementById("username");
const contentInput = document.getElementById("content");

// Holen der Posts
async function loadPosts() {
  const res = await fetch(api + "/posts");
  const posts = await res.json();

  postContainer.innerHTML = "";

  posts.forEach((post) => {
    const reacted = localStorage.getItem("reaction_" + post._id); // like/dislike/null

    postContainer.innerHTML += `
      <div class="post">
        <p><b>${post.username}</b></p>
        <p>${post.content}</p>

        <button onclick="react('${post._id}', 'like')" 
          ${reacted ? "disabled" : ""}>
          👍 ${post.likes}
        </button>

        <button onclick="react('${post._id}', 'dislike')" 
          ${reacted ? "disabled" : ""}>
          👎 ${post.dislikes}
        </button>
      </div>
      <hr>
    `;
  });
}

// Post erstellen
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = usernameInput.value;
  const content = contentInput.value;

  if (!username || !content) return alert("Bitte ausfüllen!");

  await fetch(api + "/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, content })
  });

  contentInput.value = "";
  loadPosts();
});

// Liken / Disliken
async function react(postId, action) {
  const reacted = localStorage.getItem("reaction_" + postId);
  if (reacted) return; // Schon reagiert → abblocken

  await fetch(api + "/posts/react", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, action })
  });

  // Speichere Reaktion im Browser
  localStorage.setItem("reaction_" + postId, action);

  loadPosts();
}

loadPosts();
