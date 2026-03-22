# MiniChat für Netlify (mit GitHub + Datenbank)

Dieses Projekt ist eine kleine Social-Webseite mit:
- Registrierung/Login mit Username + Passwort
- Post erstellen
- Auf Posts antworten
- Like/Dislike je Post
- Direct Messages zwischen zwei Usern
- Server-seitiger Speicherung in PostgreSQL
- Synchronisierung über Polling (alle 4 Sekunden)

## 1) GitHub-Projekt erstellen

1. Gehe auf GitHub → **New repository**.
2. Name z. B. `minichat-netlify`.
3. Repository erstellen.
4. Lokal klonen:

```bash
git clone https://github.com/<DEIN_USER>/<DEIN_REPO>.git
cd <DEIN_REPO>
```

5. Diese Dateien ins Repo legen (oder dieses Repo verwenden) und pushen:

```bash
git add .
git commit -m "feat: initial netlify social chat"
git push origin main
```

## 2) PostgreSQL Datenbank erstellen (Neon empfohlen)

Du brauchst eine externe Datenbank, weil Netlify Functions selbst keinen persistenten lokalen Speicher haben.

### Option A: Neon (einfach)
1. Auf https://neon.tech anmelden.
2. Neues Projekt erstellen.
3. Connection String kopieren (beginnt mit `postgres://...`).
4. Im SQL Editor dieses Schema ausführen:

```sql
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replies (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 3) Netlify mit GitHub verbinden

In Netlify: **Add new site → Import an existing project → GitHub** → Repo auswählen.

Bei deinen Feldern in Netlify (wie im Screenshot):

- **Project name**: frei wählbar, z. B. `minichat`
- **Branch to deploy**: `main`
- **Base directory**: leer lassen
- **Build command**: leer lassen
- **Publish directory**: `.`
- **Functions directory**: `netlify/functions`

Dann unter **Environment variables** hinzufügen:

- `DATABASE_URL` = dein PostgreSQL/Neon Connection String
- `JWT_SECRET` = ein langes zufälliges Secret (z. B. 40+ Zeichen)

Danach **Deploy** klicken.

## 4) Wichtige Befehle lokal

```bash
npm install
npm run check
```

## 5) Wie du die Seite benutzt

1. Registrieren (Username + Passwort)
2. Login
3. Posts schreiben
4. Auf Posts antworten
5. Like/Dislike klicken
6. Im DM-Bereich einen User auswählen und private Nachricht senden

## 6) Was du ggf. noch verbessern kannst

- Live Updates per WebSockets (statt Polling)
- E-Mail-Verifizierung
- Avatar + Profilseiten
- Moderation/Reporting
- Pagination für große Feeds
