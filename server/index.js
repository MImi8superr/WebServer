import bcrypt from "bcrypt";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_ORIGIN || "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

// MongoDB verbinden
if (!process.env.MONGO_URL) {
  console.warn("MONGO_URL ist nicht gesetzt. Bitte eine gültige Verbindung bereitstellen.");
}
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/social-app");
    console.log("Mit MongoDB verbunden.");
  } catch (error) {
    console.error("MongoDB-Verbindung fehlgeschlagen:", error.message);
    process.exit(1);
  }
}

connectDatabase();

// JWT Secret (fällt auf Default zurück, wenn nicht gesetzt)
const SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION";

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const User = mongoose.model("User", userSchema);

// Post Schema
const postSchema = new mongoose.Schema(
  {
    author: String,
    content: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    replies: [
      {
        author: String,
        content: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],
    reactions: {
      type: Map,
      of: String,
      default: {}
    }
  },
  { timestamps: true }
);

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
  if (!username || !password) return res.status(400).json({ error: "Benutzername und Passwort sind erforderlich." });

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = new User({ username, password: hashed });
    await user.save();
    res.json({ success: true });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Benutzername existiert bereits." });
    }
    res.status(400).json({ error: "Registrierung fehlgeschlagen." });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Benutzername und Passwort sind erforderlich." });

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Falsche Zugangsdaten." });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Falsche Zugangsdaten." });

  const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });

  res.json({ token });
});

// Post erstellen (nur eingeloggt)
app.post("/posts", auth, async (req, res) => {
  const content = (req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "Der Post-Inhalt darf nicht leer sein." });

  const post = new Post({
    author: req.user.username,
    content
  });

  await post.save();
  io.emit("post:created", post);
  res.json(post);
});

// Posts holen
app.get("/posts", async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

// Post bearbeiten
app.patch("/posts/:id", auth, async (req, res) => {
  const content = (req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "Der Post-Inhalt darf nicht leer sein." });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post nicht gefunden." });
  if (post.author !== req.user.username) return res.status(403).json({ error: "Keine Berechtigung." });

  post.content = content;
  await post.save();
  io.emit("post:updated", post);
  res.json(post);
});

// Post löschen
app.delete("/posts/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post nicht gefunden." });
  if (post.author !== req.user.username) return res.status(403).json({ error: "Keine Berechtigung." });

  await Post.deleteOne({ _id: post._id });
  io.emit("post:deleted", { id: post._id.toString() });
  res.json({ success: true });
});

// Auf Post antworten
app.post("/posts/:id/replies", auth, async (req, res) => {
  const content = (req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "Die Antwort darf nicht leer sein." });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post nicht gefunden." });

  post.replies.push({ author: req.user.username, content });
  await post.save();
  io.emit("post:updated", post);
  res.json(post);
});

// Likes / Dislikes
app.post("/posts/react", auth, async (req, res) => {
  const { postId, action } = req.body;
  if (!postId || !["like", "dislike"].includes(action)) {
    return res.status(400).json({ error: "Ungültige Anfrage." });
  }

  const post = await Post.findById(postId);
  if (!post) return res.status(404).json({ error: "Post nicht gefunden." });

  if (!post.reactions) {
    post.reactions = new Map();
  }

  const previous = post.reactions.get(req.user.username);
  if (previous === action) {
    return res.json(post);
  }

  if (previous === "like") post.likes--;
  if (previous === "dislike") post.dislikes--;

  if (action === "like") post.likes++;
  if (action === "dislike") post.dislikes++;

  post.reactions.set(req.user.username, action);

  await post.save();
  io.emit("post:updated", post);
  res.json(post);
});

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    // Verbindung geschlossen
  });
});

httpServer.listen(3000, () => console.log("Server läuft"));
