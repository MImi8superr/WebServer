import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Verbindung zur MongoDB
mongoose.connect(process.env.MONGO_URL);

// Mongo Schema
const Post = mongoose.model("Post", {
  text: String,
  likes: Number,
  dislikes: Number,
  replies: [
    {
      text: String,
      createdAt: Date
    }
  ],
  createdAt: Date
});

// Alle Posts abrufen
app.get("/posts", async (req, res) => {
  const posts = await Post.find();
  res.json(posts);
});

// Post erstellen
app.post("/post", async (req, res) => {
  const post = await Post.create({
    text: req.body.text,
    likes: 0,
    dislikes: 0,
    replies: [],
    createdAt: new Date()
  });
  res.json(post);
});

// Like
app.post("/post/:id/like", async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.likes++;
  await post.save();
  res.json(post);
});

// Dislike
app.post("/post/:id/dislike", async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.dislikes++;
  await post.save();
  res.json(post);
});

// Antwort
app.post("/post/:id/reply", async (req, res) => {
  const post = await Post.findById(req.params.id);
  post.replies.push({
    text: req.body.text,
    createdAt: new Date()
  });
  await post.save();
  res.json(post);
});

// Server starten
app.listen(3000, () => console.log("Server läuft"));
