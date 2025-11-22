import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// statische Dateien aus dem frontend-Ordner servieren
app.use(express.static(path.join(__dirname, "../frontend")));

// MongoDB verbinden (MONGO_URL kommt aus Render env)
const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
  console.error("MONGO_URL ist nicht gesetzt!");
} else {
  mongoose.connect(mongoUrl).then(() => {
    console.log("Connected to MongoDB");
  }).catch(err => {
    console.error("MongoDB connection error:", err);
  });
}

// Schema
const Post = mongoose.model("Post", {
  text: String,
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  replies: [
    {
      text: String,
      createdAt: Date
    }
  ],
  createdAt: Date
});

// API Routes
app.get("/posts", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.post("/post", async (req, res) => {
  const post = await Post.create({
    text: req.body.text || "",
    likes: 0,
    dislikes: 0,
    replies: [],
    createdAt: new Date()
  });
  res.json(post);
});

app.post("/post/:id/like", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  post.likes = (post.likes || 0) + 1;
  await post.save();
  res.json(post);
});

app.post("/post/:id/dislike", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  post.dislikes = (post.dislikes || 0) + 1;
  await post.save();
  res.json(post);
});

app.post("/post/:id/reply", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  post.replies.push({
    text: req.body.text || "",
    createdAt: new Date()
  });
  await post.save();
  res.json(post);
});

// Fallback (wenn jemand / aufruft, wird index.html aus frontend ausgeliefert)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server läuft");
});
