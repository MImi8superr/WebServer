import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB verbinden
mongoose.connect(process.env.MONGO_URL);

// JWT Secret
const SECRET = "SUPER_SECRET_KEY";

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const User = mongoose.model("User", userSchema);

// Post Schema
const postSchema = new mongoose.Schema({
  author: String,
  content: String,
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 }
});

const Post = mongoose.model("Post", postSchema);

// Middleware → token prüfen
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Registrierung
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = new User({ username, password: hashed });
    await user.save();
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Username exists" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Wrong credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Wrong credentials" });

  const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });

  res.json({ token });
});

// Post erstellen (nur eingeloggt)
app.post("/posts", auth, async (req, res) => {
  const post = new Post({
    author: req.user.username,
    content: req.body.content
  });

  await post.save();
  res.json(post);
});

// Posts holen
app.get("/posts", async (req, res) => {
  const posts = await Post.find().sort({ _id: -1 });
  res.json(posts);
});

// Likes / Dislikes
app.post("/posts/react", async (req, res) => {
  const { postId, action } = req.body;

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  if (action === "like") post.likes++;
  if (action === "dislike") post.dislikes++;

  await post.save();
  res.json(post);
});

app.listen(3000, () => console.log("Server läuft"));
