-- ============================================================
-- CINEFILE DATABASE SCHEMA  (v4 — adds Theater Submission system)
-- ============================================================

-- TABLE 1: users
-- Regular site users who browse, book, and rate curated movies.
CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email    TEXT NOT NULL
);

-- TABLE 2: bookings
-- Holds bookings for BOTH curated movies AND theater screenings.
-- screening_id is NULL for a curated-movie booking, and holds the
-- screenings.id for a theater-screening booking. This lets one
-- table serve both without duplicating booking logic.
CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL,
  movie_id     INTEGER,
  movie_title  TEXT NOT NULL,
  timing       TEXT NOT NULL,
  seats        INTEGER NOT NULL,
  total        INTEGER NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  screening_id INTEGER,
  FOREIGN KEY (username) REFERENCES users(username),
  FOREIGN KEY (screening_id) REFERENCES screenings(id)
);

-- TABLE 3: ratings
-- Ratings for the 12 CURATED movies only (movie_id matches the
-- hardcoded array in script.js). Theater screenings use their
-- own separate ratings table below -- kept apart on purpose so
-- this existing table and its behavior stay untouched.
CREATE TABLE IF NOT EXISTS ratings (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  stars    INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  UNIQUE (movie_id, username),
  FOREIGN KEY (username) REFERENCES users(username)
);

-- TABLE 4: timings
-- Show timings for the 12 CURATED movies, set by the admin.
CREATE TABLE IF NOT EXISTS timings (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL,
  time_str TEXT NOT NULL
);

-- ============================================================
-- NEW TABLES FOR THE THEATER SUBMISSION SYSTEM
-- ============================================================

-- TABLE 5: theaters
-- A completely separate login system from regular users.
-- A theater account is identified by theater_name, not a personal
-- username -- this is who is allowed to submit movie screenings.
CREATE TABLE IF NOT EXISTS theaters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  theater_name TEXT UNIQUE NOT NULL,
  email        TEXT NOT NULL,
  password     TEXT NOT NULL
);

-- TABLE 6: screenings
-- One row = one theater's submission of one movie.
-- If two theaters submit the same movie title, that creates TWO
-- rows here -- the public page groups them together by
-- movie_title so users see one movie with multiple theaters
-- underneath it (the BookMyShow-style structure).
--
-- status starts as 'pending' and is changed by the admin to
-- either 'approved' or 'rejected'. Only 'approved' rows are
-- ever shown to the public.
CREATE TABLE IF NOT EXISTS screenings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  theater_name TEXT NOT NULL,
  movie_title  TEXT NOT NULL,
  genre        TEXT NOT NULL,
  description  TEXT NOT NULL,
  poster       TEXT,
  price        INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (theater_name) REFERENCES theaters(theater_name)
);

-- TABLE 7: screening_timings
-- Show times that belong to ONE specific screening (one theater's
-- submission). A theater can submit several timings for the same
-- movie in their one submission form.
CREATE TABLE IF NOT EXISTS screening_timings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  screening_id INTEGER NOT NULL,
  time_str     TEXT NOT NULL,
  FOREIGN KEY (screening_id) REFERENCES screenings(id)
);

-- TABLE 8: screening_ratings
-- Ratings for theater-submitted movies. Kept SEPARATE from the
-- "ratings" table above because theater screenings are identified
-- by movie_title (text), not movie_id (a number from the
-- hardcoded curated movie list) -- the two ID systems don't match,
-- so mixing them into one table would cause collisions.
CREATE TABLE IF NOT EXISTS screening_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_title TEXT NOT NULL,
  username    TEXT NOT NULL,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  UNIQUE (movie_title, username),
  FOREIGN KEY (username) REFERENCES users(username)
);
