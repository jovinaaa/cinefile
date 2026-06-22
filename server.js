// ============================================================
// server.js
// This is the backend. It listens for HTTP requests from the
// browser (script.js) and responds using data from SQLite.
// ============================================================

const express = require("express");
const cors = require("cors");
const db = require("./db");
const { sendBookingConfirmation } = require("./mailer");

const app = express();
const PORT = 3000;

// ---- MIDDLEWARE ----
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// Hardcoded admin credentials -- checked on the server now.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

// ============================================================
// USER AUTH ROUTES
// ============================================================

app.post("/api/signup", (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: "Username, password, and email are required." });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (username.toLowerCase() === "admin") {
    return res.status(400).json({ error: "That username is reserved." });
  }

  try {
    const stmt = db.prepare("INSERT INTO users (username, password, email) VALUES (?, ?, ?)");
    stmt.run(username, password, email);
    res.json({ success: true, username });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Username already taken." });
    }
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ success: true, isAdmin: true, username });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (user && user.password === password) {
    return res.json({ success: true, isAdmin: false, username });
  }

  res.status(401).json({ error: "Incorrect username or password." });
});

// ============================================================
// NEW: THEATER AUTH ROUTES
// Completely separate login system from regular users. A
// theater account is identified by theater_name, and is the
// only kind of account allowed to submit movie screenings.
// ============================================================

// POST /api/theater/signup
// Body: { theaterName, email, password }
app.post("/api/theater/signup", (req, res) => {
  const { theaterName, email, password } = req.body;

  if (!theaterName || !email || !password) {
    return res.status(400).json({ error: "Theater name, email, and password are required." });
  }
  if (theaterName.length < 3) {
    return res.status(400).json({ error: "Theater name must be at least 3 characters." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  try {
    const stmt = db.prepare(
      "INSERT INTO theaters (theater_name, email, password) VALUES (?, ?, ?)"
    );
    stmt.run(theaterName, email, password);
    res.json({ success: true, theaterName });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "A theater with that name is already registered." });
    }
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/theater/login
// Body: { theaterName, password }
app.post("/api/theater/login", (req, res) => {
  const { theaterName, password } = req.body;

  if (!theaterName || !password) {
    return res.status(400).json({ error: "Theater name and password required." });
  }

  const theater = db.prepare("SELECT * FROM theaters WHERE theater_name = ?").get(theaterName);

  if (theater && theater.password === password) {
    return res.json({ success: true, theaterName });
  }

  res.status(401).json({ error: "Incorrect theater name or password." });
});

// ============================================================
// NEW: SCREENING SUBMISSION ROUTES (theater side)
// ============================================================

// POST /api/screenings
// A theater submits a movie + multiple show timings in one go.
// Body: { theaterName, movieTitle, genre, description, poster, price, timings: [..] }
app.post("/api/screenings", (req, res) => {
  const { theaterName, movieTitle, genre, description, poster, price, timings } = req.body;

  if (!theaterName || !movieTitle || !genre || !description || !price) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }
  if (!timings || timings.length === 0) {
    return res.status(400).json({ error: "Please add at least one show timing." });
  }

  const submittedAt = new Date().toLocaleDateString("en-IN");

  const stmt = db.prepare(`
    INSERT INTO screenings (theater_name, movie_title, genre, description, poster, price, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  const result = stmt.run(theaterName, movieTitle, genre, description, poster || "", price, submittedAt);

  const screeningId = result.lastInsertRowid;

  // Save every timing the theater entered, linked to this screening's ID
  const timingStmt = db.prepare(
    "INSERT INTO screening_timings (screening_id, time_str) VALUES (?, ?)"
  );
  timings.forEach(t => timingStmt.run(screeningId, t));

  res.json({ success: true, screeningId });
});

// GET /api/screenings/mine/:theaterName
// A theater views all of its own past submissions, with status,
// so they can see what's pending / approved / rejected.
app.get("/api/screenings/mine/:theaterName", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM screenings WHERE theater_name = ? ORDER BY id DESC"
  ).all(req.params.theaterName);
  res.json(rows);
});

// GET /api/screenings/public
// Returns only APPROVED screenings, grouped by movie_title, for
// the public "Theater Screenings" tab. Each movie title can have
// multiple theaters underneath it (the BookMyShow-style layout).
app.get("/api/screenings/public", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM screenings WHERE status = 'approved' ORDER BY movie_title"
  ).all();

  // Attach each screening's own timings before sending back,
  // so the frontend doesn't need a second round-trip per screening.
  const withTimings = rows.map(s => {
    const timingRows = db.prepare(
      "SELECT time_str FROM screening_timings WHERE screening_id = ?"
    ).all(s.id);
    return { ...s, timings: timingRows.map(t => t.time_str) };
  });

  res.json(withTimings);
});

// GET /api/screenings/:id  -- full detail for one specific screening
app.get("/api/screenings/:id", (req, res) => {
  const screening = db.prepare("SELECT * FROM screenings WHERE id = ?").get(req.params.id);
  if (!screening) {
    return res.status(404).json({ error: "Screening not found." });
  }
  const timingRows = db.prepare(
    "SELECT time_str FROM screening_timings WHERE screening_id = ?"
  ).all(req.params.id);
  res.json({ ...screening, timings: timingRows.map(t => t.time_str) });
});

// ============================================================
// NEW: ADMIN ROUTES FOR REVIEWING SCREENINGS
// ============================================================

// GET /api/admin/screenings  -- every submission, any status
app.get("/api/admin/screenings", (req, res) => {
  const rows = db.prepare("SELECT * FROM screenings ORDER BY id DESC").all();
  res.json(rows);
});

// POST /api/admin/screenings/:id/approve
app.post("/api/admin/screenings/:id/approve", (req, res) => {
  db.prepare("UPDATE screenings SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/screenings/:id/reject
app.post("/api/admin/screenings/:id/reject", (req, res) => {
  db.prepare("UPDATE screenings SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// BOOKING ROUTES
// Now handles BOTH curated movies and theater screenings.
// screeningId is omitted/null for a curated movie booking.
// ============================================================

app.post("/api/bookings", async (req, res) => {
  const { username, movieId, movieTitle, timing, seats, total, screeningId } = req.body;

  if (!username || !movieTitle || !timing || !seats || !total) {
    return res.status(400).json({ error: "Missing booking details." });
  }

  const now = new Date();
  const bookingDate = now.toLocaleDateString("en-IN");
  const bookingTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const stmt = db.prepare(`
    INSERT INTO bookings (username, movie_id, movie_title, timing, seats, total, booking_date, booking_time, screening_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    username, movieId || null, movieTitle, timing, seats, total,
    bookingDate, bookingTime, screeningId || null
  );

  const booking = {
    id: result.lastInsertRowid,
    username, movieId, movieTitle, timing, seats, total,
    date: bookingDate, time: bookingTime
  };

  try {
    const user = db.prepare("SELECT email FROM users WHERE username = ?").get(username);
    if (user && user.email) {
      await sendBookingConfirmation(user.email, booking);
    }
  } catch (emailErr) {
    console.error("Failed to send confirmation email:", emailErr.message);
  }

  res.json({ success: true, booking });
});

app.get("/api/bookings/:username", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM bookings WHERE username = ? ORDER BY id DESC"
  ).all(req.params.username);
  res.json(rows);
});

app.get("/api/admin/bookings", (req, res) => {
  const rows = db.prepare("SELECT * FROM bookings ORDER BY id DESC").all();
  res.json(rows);
});

// ============================================================
// RATING ROUTES (curated movies -- unchanged from before)
// ============================================================

app.post("/api/ratings", (req, res) => {
  const { movieId, username, stars } = req.body;

  if (!movieId || !username || !stars) {
    return res.status(400).json({ error: "Missing rating details." });
  }

  const stmt = db.prepare(`
    INSERT INTO ratings (movie_id, username, stars)
    VALUES (?, ?, ?)
    ON CONFLICT(movie_id, username) DO UPDATE SET stars = excluded.stars
  `);
  stmt.run(movieId, username, stars);

  res.json({ success: true });
});

app.get("/api/ratings/:movieId", (req, res) => {
  const movieId = req.params.movieId;

  const avgRow = db.prepare(
    "SELECT AVG(stars) as avg, COUNT(*) as count FROM ratings WHERE movie_id = ?"
  ).get(movieId);

  let userRating = 0;
  if (req.query.username) {
    const row = db.prepare(
      "SELECT stars FROM ratings WHERE movie_id = ? AND username = ?"
    ).get(movieId, req.query.username);
    if (row) userRating = row.stars;
  }

  res.json({
    average: avgRow.count > 0 ? avgRow.avg.toFixed(1) : null,
    count: avgRow.count,
    userRating
  });
});

app.get("/api/admin/reviews", (req, res) => {
  const rows = db.prepare("SELECT * FROM ratings ORDER BY movie_id").all();
  res.json(rows);
});

// ============================================================
// NEW: RATING ROUTES FOR THEATER SCREENINGS
// Keyed by movie_title instead of movie_id, since theater
// screenings don't have a number from the curated movie array.
// ============================================================

// POST /api/screening-ratings
// Body: { movieTitle, username, stars }
app.post("/api/screening-ratings", (req, res) => {
  const { movieTitle, username, stars } = req.body;

  if (!movieTitle || !username || !stars) {
    return res.status(400).json({ error: "Missing rating details." });
  }

  const stmt = db.prepare(`
    INSERT INTO screening_ratings (movie_title, username, stars)
    VALUES (?, ?, ?)
    ON CONFLICT(movie_title, username) DO UPDATE SET stars = excluded.stars
  `);
  stmt.run(movieTitle, username, stars);

  res.json({ success: true });
});

// GET /api/screening-ratings/:movieTitle
app.get("/api/screening-ratings/:movieTitle", (req, res) => {
  const movieTitle = req.params.movieTitle;

  const avgRow = db.prepare(
    "SELECT AVG(stars) as avg, COUNT(*) as count FROM screening_ratings WHERE movie_title = ?"
  ).get(movieTitle);

  let userRating = 0;
  if (req.query.username) {
    const row = db.prepare(
      "SELECT stars FROM screening_ratings WHERE movie_title = ? AND username = ?"
    ).get(movieTitle, req.query.username);
    if (row) userRating = row.stars;
  }

  res.json({
    average: avgRow.count > 0 ? avgRow.avg.toFixed(1) : null,
    count: avgRow.count,
    userRating
  });
});

// ============================================================
// TIMINGS ROUTES (curated movies -- unchanged from before)
// ============================================================

app.get("/api/timings/:movieId", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM timings WHERE movie_id = ?"
  ).all(req.params.movieId);
  res.json(rows);
});

app.post("/api/timings", (req, res) => {
  const { movieId, timeStr } = req.body;

  if (!movieId || !timeStr) {
    return res.status(400).json({ error: "Missing timing details." });
  }

  const existing = db.prepare(
    "SELECT * FROM timings WHERE movie_id = ? AND time_str = ?"
  ).get(movieId, timeStr);

  if (existing) {
    return res.status(400).json({ error: "That time is already scheduled." });
  }

  const stmt = db.prepare("INSERT INTO timings (movie_id, time_str) VALUES (?, ?)");
  const result = stmt.run(movieId, timeStr);
  res.json({ success: true, id: result.lastInsertRowid });
});

app.delete("/api/timings/:id", (req, res) => {
  db.prepare("DELETE FROM timings WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// ADMIN: USERS ROUTES
// ============================================================

app.get("/api/admin/users", (req, res) => {
  const users = db.prepare("SELECT username FROM users").all();

  const result = users.map(u => {
    const bookingStats = db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total),0) as spent FROM bookings WHERE username = ?"
    ).get(u.username);

    const ratingCount = db.prepare(
      "SELECT COUNT(*) as count FROM ratings WHERE username = ?"
    ).get(u.username);

    return {
      username: u.username,
      bookingCount: bookingStats.count,
      totalSpent: bookingStats.spent,
      ratingsGiven: ratingCount.count
    };
  });

  res.json(result);
});

app.delete("/api/admin/users/:username", (req, res) => {
  const username = req.params.username;

  db.prepare("DELETE FROM ratings WHERE username = ?").run(username);
  db.prepare("DELETE FROM bookings WHERE username = ?").run(username);
  db.prepare("DELETE FROM users WHERE username = ?").run(username);

  res.json({ success: true });
});

// ============================================================
// START THE SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`CineFile server running at http://localhost:${PORT}`);
});
