import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB verbinden
mongoose.connect("mongodb://localhost:27017/socialapp");

// Mongoose Schema
const postSchema = new mongoose.Schema({
  username: String,
  content: String,
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 }
});

const Post = mongoose.model("Post", postSchema);

// Alle Posts holen
app.get("/posts", async (req, res) => {
  const posts = await Post.find().sort({ _id: -1 });
  res.json(posts);
});

// Neuen Post erstellen
app.post("/posts", async (req, res) => {
  const { username, content } = req.body;

  const post = new Post({
    username,
    content,
    likes: 0,
    dislikes: 0
  });

  await post.save();
  res.json(post);
});

// Like/Dislike updaten
app.post("/posts/react", async (req, res) => {
  const { postId, action } = req.body;

  const post = await Post.findById(postId);

  if (!post) return res.status(404).json({ error: "Post not found" });

  if (action === "like") post.likes++;
  if (action === "dislike") post.dislikes++;

  await post.save();
  res.json(post);
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));

