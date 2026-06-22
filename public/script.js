// ============================================================
// CINEFILE - script.js  (v4 — adds Theater Submission system)
//
// Every function still talks to the SQL backend via fetch().
// NEW in this version: a separate theater login system, a
// submission form for theaters, an admin approval panel, and
// a "Theater Screenings" catalog tab on the home page that
// groups approved submissions by movie title (BookMyShow-style).
// ============================================================

const API_BASE = "/api";

// ---- CURATED MOVIE DATA (unchanged) ----
const movies = [
  { id: 1,  title: "Inception",        genre: "Sci-Fi",    year: 2010, price: 180,
    description: "A thief who enters the dreams of others to steal secrets gets a chance to have his crime erased.",
    poster: "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg" },
  { id: 2,  title: "The Dark Knight",  genre: "Action",    year: 2008, price: 180,
    description: "Batman faces the Joker, a criminal mastermind who plunges Gotham into anarchy.",
    poster: "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29.jpg" },
  { id: 3,  title: "Interstellar",     genre: "Sci-Fi",    year: 2014, price: 200,
    description: "A team of explorers travel through a wormhole in space to ensure humanity's survival.",
    poster: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg" },
  { id: 4,  title: "The Godfather",    genre: "Drama",     year: 1972, price: 150,
    description: "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
    poster: "https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg" },
  { id: 5,  title: "Parasite",         genre: "Thriller",  year: 2019, price: 160,
    description: "A poor family schemes to become employed by a wealthy family, with unexpected consequences.",
    poster: "https://upload.wikimedia.org/wikipedia/en/5/53/Parasite_%282019_film%29.png" },
  { id: 6,  title: "Spirited Away",    genre: "Animation", year: 2001, price: 140,
    description: "A young girl wanders into a world ruled by spirits and must find a way back to her family.",
    poster: "https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png" },
  { id: 7,  title: "The Matrix",       genre: "Sci-Fi",    year: 1999, price: 170,
    description: "A hacker discovers reality is a simulation and joins a rebellion against the machines.",
    poster: "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Matrix_Poster.jpg" },
  { id: 8,  title: "Pulp Fiction",     genre: "Drama",     year: 1994, price: 160,
    description: "The lives of criminals in Los Angeles interweave in four tales of violence and redemption.",
    poster: "https://upload.wikimedia.org/wikipedia/en/3/3b/Pulp_Fiction_%281994%29_poster.jpg" },
  { id: 9,  title: "Dune",             genre: "Sci-Fi",    year: 2021, price: 200,
    description: "A noble family becomes embroiled in war over control of the desert planet Arrakis.",
    poster: "https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg" },
  { id: 10, title: "Get Out",          genre: "Thriller",  year: 2017, price: 150,
    description: "A man visits his girlfriend's family estate and discovers a disturbing secret.",
    poster: "https://upload.wikimedia.org/wikipedia/en/a/a8/Get_Out_poster.png" },
  { id: 11, title: "Coco",             genre: "Animation", year: 2017, price: 140,
    description: "A young boy visits the Land of the Dead to find his great-great-grandfather.",
    poster: "https://upload.wikimedia.org/wikipedia/en/9/98/Coco_%282017_film%29_poster.jpg" },
  { id: 12, title: "Schindler's List", genre: "Drama",     year: 1993, price: 150,
    description: "A German businessman saves over a thousand Jewish lives during the Holocaust.",
    poster: "https://upload.wikimedia.org/wikipedia/en/3/38/Schindler%27s_List_movie.jpg" }
];

const allGenres = ["All", ...new Set(movies.map(m => m.genre))];

// ---- APP STATE ----
let currentUser    = null;
let isAdmin        = false;
let currentTheater = null;   // NEW: logged-in theater's name (separate from currentUser)
let selectedMovie  = null;   // curated movie currently selected
let selectedScreening = null; // NEW: a specific theater's screening currently selected for booking
let activeGenre    = "All";
let activeCatalog  = "curated"; // NEW: "curated" or "theaters" -- which home tab is showing
let pendingAction  = null;
let submissionTimings = []; // NEW: timings being built up in the theater submission form
let isBookingInProgress = false; // guards confirmBooking() against double-clicks/double-submits

// ============================================================
// API HELPER
// ============================================================
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

// ============================================================
// PAGE ROUTING
// ============================================================
function showPage(pageName) {
  const allPages = [
    "page-home", "page-detail", "page-screening-detail",
    "page-booking", "page-mybookings", "page-confirmation",
    "page-admin", "page-theater-dashboard"
  ];
  allPages.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const target = document.getElementById("page-" + pageName);
  if (target) target.style.display = "block";

  // Show the right navbar: guest, user, admin, or theater.
  document.getElementById("guest-navbar").style.display =
    (!currentUser && !isAdmin && !currentTheater) ? "flex" : "none";
  document.getElementById("navbar").style.display =
    (currentUser && !isAdmin) ? "flex" : "none";
  document.getElementById("admin-navbar").style.display =
    isAdmin ? "flex" : "none";
  document.getElementById("theater-navbar").style.display =
    currentTheater ? "flex" : "none";

  // Hide the theater sidebar icon while a theater is already logged in
  // or while the admin dashboard is open (it would be confusing there).
  const icon = document.getElementById("theater-sidebar-icon");
  icon.style.display = (currentTheater || isAdmin) ? "none" : "flex";
}

// ============================================================
// USER AUTH MODAL (unchanged from before)
// ============================================================

function openAuthModal(mode, reason) {
  document.getElementById("auth-modal-overlay").style.display = "flex";
  document.getElementById("auth-modal-reason").textContent = reason || "Your movie, your seat, your night.";

  const lf  = document.getElementById("login-form");
  const sf  = document.getElementById("signup-form");
  const btn = document.getElementById("toggle-auth-btn");

  if (mode === "signup") {
    lf.style.display = "none"; sf.style.display = "block";
    btn.textContent  = "Already have an account? Log in";
  } else {
    lf.style.display = "block"; sf.style.display = "none";
    btn.textContent  = "Don't have an account? Sign up";
  }
  document.getElementById("login-error").textContent  = "";
  document.getElementById("signup-error").textContent = "";
}

function closeAuthModal() {
  document.getElementById("auth-modal-overlay").style.display = "none";
  pendingAction = null;
}

function requireLoginThen(action, extra) {
  if (currentUser) {
    runPendingAction({ action, ...extra });
    return;
  }
  pendingAction = { action, ...extra };
  const reasonText = action === "book"
    ? "Log in to book your tickets."
    : "Log in to rate this movie.";
  openAuthModal("login", reasonText);
}

function runPendingAction(action) {
  if (!action) { renderHome(); showPage("home"); return; }

  if (action.action === "book") {
    openBooking();
  } else if (action.action === "rate") {
    submitRating(action.stars);
  } else if (action.action === "rate-screening") {
    submitScreeningRating(action.stars);
  } else if (action.action === "book-screening") {
    openScreeningBooking();
  } else {
    renderHome();
    showPage("home");
  }
}

function toggleAuthMode() {
  const lf  = document.getElementById("login-form");
  const sf  = document.getElementById("signup-form");
  const btn = document.getElementById("toggle-auth-btn");
  const isLogin = lf.style.display !== "none";

  lf.style.display  = isLogin ? "none"  : "block";
  sf.style.display  = isLogin ? "block" : "none";
  btn.textContent   = isLogin ? "Already have an account? Log in" : "Don't have an account? Sign up";

  document.getElementById("login-error").textContent  = "";
  document.getElementById("signup-error").textContent = "";
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const error    = document.getElementById("login-error");

  if (!username || !password) { error.textContent = "Please fill in all fields."; return; }

  try {
    const data = await api("/login", { method: "POST", body: JSON.stringify({ username, password }) });
    error.textContent = "";
    closeAuthModalSilently();

    if (data.isAdmin) {
      isAdmin = true; currentUser = null;
      showPage("admin");
      showAdminPanel("users");
    } else {
      currentUser = username; isAdmin = false;
      document.getElementById("user-greeting").textContent = "Hi, " + currentUser;
      const action = pendingAction; pendingAction = null;
      if (action) { runPendingAction(action); } else { renderHome(); showPage("home"); }
    }
  } catch (err) {
    error.textContent = err.message;
  }
}

async function handleSignup() {
  const username = document.getElementById("signup-username").value.trim();
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const error    = document.getElementById("signup-error");

  if (!username || !password || !email) { error.textContent = "Please fill in all fields."; return; }
  if (username.length < 3)    { error.textContent = "Username must be at least 3 characters."; return; }
  if (password.length < 4)    { error.textContent = "Password must be at least 4 characters."; return; }

  try {
    await api("/signup", { method: "POST", body: JSON.stringify({ username, password, email }) });
    error.textContent = "";
    currentUser = username; isAdmin = false;
    document.getElementById("user-greeting").textContent = "Hi, " + currentUser;
    closeAuthModalSilently();

    const action = pendingAction; pendingAction = null;
    if (action) { runPendingAction(action); } else { renderHome(); showPage("home"); }
  } catch (err) {
    error.textContent = err.message;
  }
}

function closeAuthModalSilently() {
  document.getElementById("auth-modal-overlay").style.display = "none";
}

function handleLogout() {
  currentUser = null; isAdmin = false;
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("login-error").textContent = "";
  renderHome();
  showPage("home");
}

function handleAdminLogout() {
  handleLogout();
}

// ============================================================
// NEW: THEATER AUTH MODAL
// A completely separate login system. currentTheater is tracked
// apart from currentUser -- a person could be logged in as a
// regular user in one tab and a theater in another, but not both
// inside the same session, since logging into one logs out the other.
// ============================================================

function openTheaterAuthModal(mode) {
  document.getElementById("theater-auth-modal-overlay").style.display = "flex";

  const lf  = document.getElementById("theater-login-form");
  const sf  = document.getElementById("theater-signup-form");
  const btn = document.getElementById("toggle-theater-auth-btn");

  if (mode === "signup") {
    lf.style.display = "none"; sf.style.display = "block";
    btn.textContent  = "Already registered? Log in";
  } else {
    lf.style.display = "block"; sf.style.display = "none";
    btn.textContent  = "New theater? Register here";
  }
  document.getElementById("theater-login-error").textContent  = "";
  document.getElementById("theater-signup-error").textContent = "";
}

function closeTheaterAuthModal() {
  document.getElementById("theater-auth-modal-overlay").style.display = "none";
}

function toggleTheaterAuthMode() {
  const lf  = document.getElementById("theater-login-form");
  const sf  = document.getElementById("theater-signup-form");
  const btn = document.getElementById("toggle-theater-auth-btn");
  const isLogin = lf.style.display !== "none";

  lf.style.display = isLogin ? "none"  : "block";
  sf.style.display = isLogin ? "block" : "none";
  btn.textContent  = isLogin ? "Already registered? Log in" : "New theater? Register here";

  document.getElementById("theater-login-error").textContent  = "";
  document.getElementById("theater-signup-error").textContent = "";
}

async function handleTheaterLogin() {
  const theaterName = document.getElementById("theater-login-name").value.trim();
  const password    = document.getElementById("theater-login-password").value;
  const error       = document.getElementById("theater-login-error");

  if (!theaterName || !password) { error.textContent = "Please fill in all fields."; return; }

  try {
    const data = await api("/theater/login", {
      method: "POST",
      body: JSON.stringify({ theaterName, password })
    });
    error.textContent = "";
    currentTheater = data.theaterName;
    document.getElementById("theater-greeting").textContent = "Hi, " + currentTheater;
    closeTheaterAuthModal();
    showTheaterDashboard();
  } catch (err) {
    error.textContent = err.message;
  }
}

async function handleTheaterSignup() {
  const theaterName = document.getElementById("theater-signup-name").value.trim();
  const email       = document.getElementById("theater-signup-email").value.trim();
  const password    = document.getElementById("theater-signup-password").value;
  const error       = document.getElementById("theater-signup-error");

  if (!theaterName || !email || !password) { error.textContent = "Please fill in all fields."; return; }
  if (theaterName.length < 3) { error.textContent = "Theater name must be at least 3 characters."; return; }
  if (password.length < 4)    { error.textContent = "Password must be at least 4 characters."; return; }

  try {
    await api("/theater/signup", {
      method: "POST",
      body: JSON.stringify({ theaterName, email, password })
    });
    error.textContent = "";
    currentTheater = theaterName;
    document.getElementById("theater-greeting").textContent = "Hi, " + currentTheater;
    closeTheaterAuthModal();
    showTheaterDashboard();
  } catch (err) {
    error.textContent = err.message;
  }
}

function handleTheaterLogout() {
  currentTheater = null;
  document.getElementById("theater-login-name").value = "";
  document.getElementById("theater-login-password").value = "";
  renderHome();
  showPage("home");
}

// ============================================================
// NEW: THEATER DASHBOARD
// ============================================================

function showTheaterDashboard() {
  showPage("theater-dashboard");
  showTheaterTab("submit");
}

function showTheaterTab(tabName) {
  const tabs = ["submit", "mine"];
  tabs.forEach(t => {
    document.getElementById("theater-panel-" + t).style.display = "none";
    document.getElementById("theater-tab-" + t).classList.remove("active-tab");
  });
  document.getElementById("theater-panel-" + tabName).style.display = "block";
  document.getElementById("theater-tab-" + tabName).classList.add("active-tab");

  if (tabName === "mine") renderMySubmissions();
}

// Add one timing chip to the in-progress submission form.
// These are held in the submissionTimings array until the whole
// form is submitted together as one request.
function addSubmissionTiming() {
  const input = document.getElementById("sub-timing-input");
  const val = input.value.trim();
  const err = document.getElementById("submission-error");

  if (!val) { err.textContent = "Please enter a show time first."; return; }
  if (submissionTimings.includes(val)) { err.textContent = "That timing was already added."; return; }

  submissionTimings.push(val);
  input.value = "";
  err.textContent = "";
  renderSubmissionTimings();
}

function removeSubmissionTiming(index) {
  submissionTimings.splice(index, 1);
  renderSubmissionTimings();
}

function renderSubmissionTimings() {
  const container = document.getElementById("sub-timings-list");
  container.innerHTML = submissionTimings.map((t, i) => `
    <span class="timing-badge">
      ${t}
      <button class="timing-remove-btn" onclick="removeSubmissionTiming(${i})">x</button>
    </span>`).join("");
}

// Submits the whole form -- movie details + every timing added --
// as ONE request to POST /api/screenings.
async function submitScreening() {
  const movieTitle  = document.getElementById("sub-movie-title").value.trim();
  const genre       = document.getElementById("sub-genre").value.trim();
  const description = document.getElementById("sub-description").value.trim();
  const poster      = document.getElementById("sub-poster").value.trim();
  const price       = parseInt(document.getElementById("sub-price").value);
  const error       = document.getElementById("submission-error");

  if (!movieTitle || !genre || !description || !price) {
    error.textContent = "Please fill in all movie details.";
    return;
  }
  if (submissionTimings.length === 0) {
    error.textContent = "Please add at least one show timing.";
    return;
  }

  try {
    await api("/screenings", {
      method: "POST",
      body: JSON.stringify({
        theaterName: currentTheater,
        movieTitle, genre, description, poster, price,
        timings: submissionTimings
      })
    });

    // Reset the form for the next submission
    document.getElementById("sub-movie-title").value  = "";
    document.getElementById("sub-genre").value        = "";
    document.getElementById("sub-description").value  = "";
    document.getElementById("sub-poster").value       = "";
    document.getElementById("sub-price").value        = "";
    submissionTimings = [];
    renderSubmissionTimings();
    error.textContent = "";

    alert("Your screening has been submitted for admin approval.");
    showTheaterTab("mine");
  } catch (err) {
    error.textContent = err.message;
  }
}

// Shows this theater's own past submissions with their status.
async function renderMySubmissions() {
  const rows = await api(`/screenings/mine/${encodeURIComponent(currentTheater)}`);
  const container = document.getElementById("theater-mine-list");
  container.innerHTML = "";

  if (rows.length === 0) {
    container.innerHTML = "<p class='muted'>You haven't submitted any screenings yet.</p>";
    return;
  }

  rows.forEach(s => {
    const card = document.createElement("div");
    card.className = "submission-card status-" + s.status;
    card.innerHTML = `
      <div class="submission-card-header">
        <strong>${s.movie_title}</strong>
        <span class="status-badge status-${s.status}">${s.status}</span>
      </div>
      <p class="muted">${s.genre} &middot; Rs. ${s.price} &middot; Submitted ${s.submitted_at}</p>`;
    container.appendChild(card);
  });
}

// ============================================================
// HOME PAGE -- CATALOG SWITCHING (NEW)
// Two tabs: "curated" (the original 12-movie grid) and
// "theaters" (approved screenings, grouped by movie title).
// ============================================================

function switchCatalog(catalogName) {
  activeCatalog = catalogName;

  document.getElementById("catalog-tab-curated").classList.toggle("active-tab", catalogName === "curated");
  document.getElementById("catalog-tab-theaters").classList.toggle("active-tab", catalogName === "theaters");

  const showCurated = catalogName === "curated";
  document.getElementById("genre-filters").style.display = showCurated ? "flex" : "none";
  document.getElementById("movie-grid").style.display     = showCurated ? "grid" : "none";
  document.getElementById("theater-screenings-grid").style.display = showCurated ? "none" : "grid";

  if (showCurated) {
    renderHome();
  } else {
    renderTheaterScreenings();
  }
}

async function renderHome(genre = activeGenre, searchTerm = "") {
  activeGenre = genre;

  const gc = document.getElementById("genre-filters");
  gc.innerHTML = "";
  allGenres.forEach(g => {
    const btn = document.createElement("button");
    btn.textContent = g;
    btn.className = "genre-btn" + (g === activeGenre ? " active" : "");
    btn.onclick = () => renderHome(g, document.getElementById("search-input").value);
    gc.appendChild(btn);
  });

  let filtered = movies;
  if (genre !== "All") filtered = filtered.filter(m => m.genre === genre);
  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
  }

  const grid = document.getElementById("movie-grid");
  grid.innerHTML = "";
  if (filtered.length === 0) {
    grid.innerHTML = "<p style='color:#888; grid-column:1/-1;'>No movies found.</p>";
    return;
  }

  const ratingResults = await Promise.all(filtered.map(m => api(`/ratings/${m.id}`)));

  filtered.forEach((movie, i) => {
    const r = ratingResults[i];
    const ratingText = r.average ? `${r.average} / 5` : "No ratings yet";

    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () => openDetail(movie);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}" class="movie-poster"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
      <div class="poster-fallback" style="display:none;"><span>${movie.title}</span></div>
      <div class="card-info">
        <h3 class="card-title">${movie.title}</h3>
        <p class="card-meta">${movie.genre} &middot; ${movie.year}</p>
        <p class="card-rating">Rating: ${ratingText}</p>
      </div>`;
    grid.appendChild(card);
  });
}

function handleSearch() {
  if (activeCatalog === "curated") {
    renderHome(activeGenre, document.getElementById("search-input").value);
  } else {
    renderTheaterScreenings(document.getElementById("search-input").value);
  }
}

// ---- NEW: render the Theater Screenings tab, grouped by movie title ----
async function renderTheaterScreenings(searchTerm = "") {
  const rows = await api("/screenings/public");
  const grid = document.getElementById("theater-screenings-grid");
  grid.innerHTML = "";

  // Group the flat list of approved screenings by movie_title,
  // so "Inception" submitted by 3 different theaters becomes
  // ONE card with 3 theaters listed underneath it.
  const grouped = {};
  rows.forEach(s => {
    if (!grouped[s.movie_title]) grouped[s.movie_title] = [];
    grouped[s.movie_title].push(s);
  });

  let movieTitles = Object.keys(grouped);
  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    movieTitles = movieTitles.filter(t =>
      t.toLowerCase().includes(q) || grouped[t][0].genre.toLowerCase().includes(q)
    );
  }

  if (movieTitles.length === 0) {
    grid.innerHTML = "<p style='color:#888; grid-column:1/-1;'>No theater screenings available yet.</p>";
    return;
  }

  // Fetch the average rating for each movie title in parallel
  const ratingResults = await Promise.all(
    movieTitles.map(t => api(`/screening-ratings/${encodeURIComponent(t)}`))
  );

  movieTitles.forEach((title, i) => {
    const group = grouped[title];
    const first = group[0]; // use the first submission's poster/genre/description for the card
    const r = ratingResults[i];
    const ratingText = r.average ? `${r.average} / 5` : "No ratings yet";

    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () => openScreeningDetail(title, group);
    card.innerHTML = `
      <img src="${first.poster}" alt="${title}" class="movie-poster"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
      <div class="poster-fallback" style="display:none;"><span>${title}</span></div>
      <div class="card-info">
        <h3 class="card-title">${title}</h3>
        <p class="card-meta">${first.genre} &middot; ${group.length} theater${group.length !== 1 ? "s" : ""}</p>
        <p class="card-rating">Rating: ${ratingText}</p>
      </div>`;
    grid.appendChild(card);
  });
}

// ============================================================
// CURATED MOVIE DETAIL PAGE (unchanged from before)
// ============================================================

async function openDetail(movie) {
  selectedMovie = movie;

  document.getElementById("detail-title").textContent = movie.title;
  document.getElementById("detail-genre").textContent = movie.genre + " - " + movie.year;
  document.getElementById("detail-desc").textContent  = movie.description;
  document.getElementById("detail-price").textContent = "Ticket Price: Rs. " + movie.price;

  const img      = document.getElementById("detail-poster");
  const fallback = document.getElementById("detail-poster-fallback");
  img.src = movie.poster; img.alt = movie.title;
  img.style.display = "block"; fallback.style.display = "none";
  fallback.textContent = movie.title;
  img.onerror = () => { img.style.display = "none"; fallback.style.display = "flex"; };

  const timingsDiv = document.getElementById("detail-timings");
  const timingRows = await api(`/timings/${movie.id}`);
  timingsDiv.innerHTML = timingRows.length > 0
    ? "<p class='timings-label'>Show Times:</p>" + timingRows.map(t => `<span class="timing-badge">${t.time_str}</span>`).join("")
    : "<p class='timings-label muted'>No show times set yet.</p>";

  const username = currentUser ? `?username=${encodeURIComponent(currentUser)}` : "";
  const ratingData = await api(`/ratings/${movie.id}${username}`);
  document.getElementById("detail-avg-rating").textContent =
    "Average Rating: " + (ratingData.average ? `${ratingData.average} / 5` : "No ratings yet");

  renderStars(ratingData.userRating || 0);
  showPage("detail");
}

function renderStars(selected) {
  const container = document.getElementById("star-rating");
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (i <= selected ? " filled" : "");
    star.textContent = i <= selected ? "★" : "☆";
    star.onclick = () => {
      if (!currentUser) { requireLoginThen("rate", { stars: i }); return; }
      submitRating(i);
    };
    container.appendChild(star);
  }
}

async function submitRating(stars) {
  try {
    await api("/ratings", {
      method: "POST",
      body: JSON.stringify({ movieId: selectedMovie.id, username: currentUser, stars })
    });
    renderStars(stars);
    const ratingData = await api(`/ratings/${selectedMovie.id}?username=${encodeURIComponent(currentUser)}`);
    document.getElementById("detail-avg-rating").textContent =
      "Average Rating: " + (ratingData.average ? `${ratingData.average} / 5` : "No ratings yet");
  } catch (err) {
    alert(err.message);
  }
}

// ============================================================
// NEW: THEATER SCREENING DETAIL PAGE
// Shows ONE movie title with every approved theater playing it,
// each as its own row with its own price and "Book" button.
// ============================================================

let currentScreeningGroup = []; // holds the group of screenings for the open detail page

async function openScreeningDetail(movieTitle, group) {
  currentScreeningGroup = group;
  const first = group[0];

  document.getElementById("screening-detail-title").textContent = movieTitle;
  document.getElementById("screening-detail-genre").textContent = first.genre;
  document.getElementById("screening-detail-desc").textContent  = first.description;

  const img      = document.getElementById("screening-detail-poster");
  const fallback = document.getElementById("screening-detail-poster-fallback");
  img.src = first.poster; img.alt = movieTitle;
  img.style.display = "block"; fallback.style.display = "none";
  fallback.textContent = movieTitle;
  img.onerror = () => { img.style.display = "none"; fallback.style.display = "flex"; };

  // Average rating, keyed by movie_title (shared across all theaters showing it)
  const username = currentUser ? `?username=${encodeURIComponent(currentUser)}` : "";
  const ratingData = await api(`/screening-ratings/${encodeURIComponent(movieTitle)}${username}`);
  document.getElementById("screening-detail-avg-rating").textContent =
    "Average Rating: " + (ratingData.average ? `${ratingData.average} / 5` : "No ratings yet");
  renderScreeningStars(ratingData.userRating || 0, movieTitle);

  // List every theater playing this movie, each with its own
  // price and a Book button -- the actual BookMyShow-style part.
  const listDiv = document.getElementById("screening-theaters-list");
  listDiv.innerHTML = group.map(s => `
    <div class="theater-row">
      <div class="theater-row-info">
        <strong>${s.theater_name}</strong>
        <span class="theater-row-price">Rs. ${s.price} per ticket</span>
        <div class="theater-row-timings">
          ${s.timings.map(t => `<span class="timing-badge">${t}</span>`).join("")}
        </div>
      </div>
      <button class="btn-primary small-btn" onclick='openScreeningBookingFor(${s.id})'>Book</button>
    </div>`).join("");

  showPage("screening-detail");
}

function renderScreeningStars(selected, movieTitle) {
  const container = document.getElementById("screening-star-rating");
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (i <= selected ? " filled" : "");
    star.textContent = i <= selected ? "★" : "☆";
    star.onclick = () => {
      if (!currentUser) { requireLoginThen("rate-screening", { stars: i, movieTitle }); return; }
      submitScreeningRating(i, movieTitle);
    };
    container.appendChild(star);
  }
}

async function submitScreeningRating(stars, movieTitle) {
  const title = movieTitle || document.getElementById("screening-detail-title").textContent;
  try {
    await api("/screening-ratings", {
      method: "POST",
      body: JSON.stringify({ movieTitle: title, username: currentUser, stars })
    });
    renderScreeningStars(stars, title);
    const ratingData = await api(`/screening-ratings/${encodeURIComponent(title)}?username=${encodeURIComponent(currentUser)}`);
    document.getElementById("screening-detail-avg-rating").textContent =
      "Average Rating: " + (ratingData.average ? `${ratingData.average} / 5` : "No ratings yet");
  } catch (err) {
    alert(err.message);
  }
}

// Called when a guest/user clicks "Book" on a specific theater's row.
function openScreeningBookingFor(screeningId) {
  selectedScreening = currentScreeningGroup.find(s => s.id === screeningId);
  if (!currentUser) { requireLoginThen("book-screening"); return; }
  openScreeningBooking();
}

function openScreeningBooking() {
  if (!selectedScreening) return;

  document.getElementById("booking-title").textContent = selectedScreening.movie_title;
  const theaterTag = document.getElementById("booking-theater-name");
  theaterTag.style.display = "block";
  theaterTag.textContent = "Theater: " + selectedScreening.theater_name;
  document.getElementById("booking-price-info").textContent = "Price per ticket: Rs. " + selectedScreening.price;
  document.getElementById("seat-count").value = 1;
  document.getElementById("booking-back-btn").onclick = () => {
    switchCatalog("theaters");
    openScreeningDetail(selectedScreening.movie_title, currentScreeningGroup);
  };

  const select = document.getElementById("timing-select");
  select.innerHTML = "";
  selectedScreening.timings.forEach(t => {
    const opt = document.createElement("option");
    opt.textContent = t; opt.value = t;
    select.appendChild(opt);
  });

  updateScreeningTotal();
  isBookingInProgress = false;
  document.getElementById("confirm-booking-btn").disabled = false;
  showPage("booking");
}

function updateScreeningTotal() {
  const seats = parseInt(document.getElementById("seat-count").value) || 1;
  document.getElementById("booking-total").textContent = "Total: Rs. " + (seats * selectedScreening.price);
}

// ============================================================
// BOOKING PAGE (curated movies -- unchanged logic, kept separate
// from the screening booking functions above)
// ============================================================

function openBooking() {
  if (!currentUser) { requireLoginThen("book"); return; }
  loadBookingPage();
}

async function loadBookingPage() {
  document.getElementById("booking-title").textContent      = selectedMovie.title;
  document.getElementById("booking-theater-name").style.display = "none";
  document.getElementById("booking-price-info").textContent = "Price per ticket: Rs. " + selectedMovie.price;
  document.getElementById("seat-count").value = 1;
  document.getElementById("booking-back-btn").onclick = () => showPage("detail");

  const select = document.getElementById("timing-select");
  select.innerHTML = "";
  const timingRows = await api(`/timings/${selectedMovie.id}`);

  if (timingRows.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Any time (no schedule set)"; opt.value = "Not specified";
    select.appendChild(opt);
  } else {
    timingRows.forEach(t => {
      const opt = document.createElement("option");
      opt.textContent = t.time_str; opt.value = t.time_str;
      select.appendChild(opt);
    });
  }

  updateTotal();
  isBookingInProgress = false;
  document.getElementById("confirm-booking-btn").disabled = false;
  showPage("booking");
}

function updateTotal() {
  // Routes to the correct total calculation depending on whether
  // a curated movie or a theater screening is being booked.
  if (selectedScreening && !selectedMovie) {
    updateScreeningTotal();
    return;
  }
  const seats = parseInt(document.getElementById("seat-count").value) || 1;
  document.getElementById("booking-total").textContent = "Total: Rs. " + (seats * selectedMovie.price);
}

async function confirmBooking() {
  // Guard against double-clicks / double-submits. If a booking
  // request is already in flight, ignore any extra clicks instead
  // of sending a second identical booking to the server.
  if (isBookingInProgress) return;

  const seats = parseInt(document.getElementById("seat-count").value);
  if (!seats || seats < 1 || seats > 10) {
    alert("Please enter a valid number of seats (1 to 10).");
    return;
  }
  const timing = document.getElementById("timing-select").value;

  // Decide which kind of booking this is based on what's selected
  const isScreeningBooking = selectedScreening && document.getElementById("booking-theater-name").style.display !== "none";

  const bodyData = isScreeningBooking
    ? {
        username:    currentUser,
        movieTitle:  selectedScreening.movie_title,
        timing:      timing,
        seats:       seats,
        total:       seats * selectedScreening.price,
        screeningId: selectedScreening.id
      }
    : {
        username:   currentUser,
        movieId:    selectedMovie.id,
        movieTitle: selectedMovie.title,
        timing:     timing,
        seats:      seats,
        total:      seats * selectedMovie.price
      };

  const confirmBtn = document.getElementById("confirm-booking-btn");
  isBookingInProgress = true;
  confirmBtn.disabled = true;

  try {
    const data = await api("/bookings", { method: "POST", body: JSON.stringify(bodyData) });
    selectedScreening = null; // clear so the next booking doesn't get confused
    showConfirmation(data.booking);
  } catch (err) {
    alert(err.message);
  } finally {
    // Always release the lock and re-enable the button, whether
    // the booking succeeded or failed -- otherwise a failed
    // booking would permanently lock the button.
    isBookingInProgress = false;
    confirmBtn.disabled = false;
  }
}

// ============================================================
// CONFIRMATION PAGE
// ============================================================

function showConfirmation(booking) {
  document.getElementById("conf-movie").textContent  = booking.movieTitle;
  document.getElementById("conf-timing").textContent = booking.timing;
  document.getElementById("conf-seats").textContent  = booking.seats;
  document.getElementById("conf-total").textContent  = "Rs. " + booking.total;
  document.getElementById("conf-date").textContent   = booking.date + " at " + booking.time;
  document.getElementById("conf-id").textContent     = "Booking ID: #" + booking.id;
  showPage("confirmation");
}

// ============================================================
// MY BOOKINGS
// ============================================================

async function openMyBookings() {
  if (!currentUser) { requireLoginThen("mybookings"); return; }

  const mine = await api(`/bookings/${encodeURIComponent(currentUser)}`);
  const container = document.getElementById("bookings-list");
  container.innerHTML = "";

  if (mine.length === 0) {
    container.innerHTML = "<p style='color:#888;'>You have no bookings yet.</p>";
  } else {
    mine.forEach(b => {
      const card = document.createElement("div");
      card.className = "booking-item";
      card.innerHTML = `
        <h3>${b.movie_title}</h3>
        <p>Show: ${b.timing || "Not specified"}</p>
        <p>${b.booking_date} at ${b.booking_time}</p>
        <p>Seats: ${b.seats} &nbsp;|&nbsp; Total: Rs. ${b.total}</p>
        <p class="booking-id">Booking ID: #${b.id}</p>`;
      container.appendChild(card);
    });
  }
  showPage("mybookings");
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================

function showAdminPanel(panelName) {
  showPage("admin");
  const panelNames = ["users", "bookings", "reviews", "timings", "screenings"];

  panelNames.forEach(name => {
    document.getElementById("admin-panel-" + name).style.display = "none";
    document.getElementById("tab-" + name).classList.remove("active-tab");
  });

  document.getElementById("admin-panel-" + panelName).style.display = "block";
  document.getElementById("tab-" + panelName).classList.add("active-tab");

  if (panelName === "users")      renderAdminUsers();
  if (panelName === "bookings")   renderAdminBookings();
  if (panelName === "reviews")    renderAdminReviews();
  if (panelName === "timings")    renderAdminTimings();
  if (panelName === "screenings") renderAdminScreenings();
}

async function renderAdminUsers() {
  const users = await api("/admin/users");
  const container = document.getElementById("admin-users-list");
  container.innerHTML = "";
  document.getElementById("admin-user-count").textContent =
    users.length + " registered user" + (users.length !== 1 ? "s" : "");

  if (users.length === 0) { container.innerHTML = "<p class='muted'>No users have signed up yet.</p>"; return; }

  const table = document.createElement("table");
  table.className = "admin-table";
  table.innerHTML = `<thead><tr><th>Username</th><th>Bookings</th><th>Total Spent (Rs.)</th><th>Ratings Given</th><th>Action</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td><td>${u.bookingCount}</td><td>${u.totalSpent}</td><td>${u.ratingsGiven}</td>
      <td><button class="admin-delete-btn" onclick="deleteUser('${u.username}')">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function deleteUser(username) {
  if (!confirm("Delete user '" + username + "'? This will also remove their bookings and ratings.")) return;
  await api(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
  renderAdminUsers();
}

async function renderAdminBookings() {
  const bookings  = await api("/admin/bookings");
  const container = document.getElementById("admin-bookings-list");
  const statsDiv  = document.getElementById("admin-stats");

  const totalRevenue = bookings.reduce((sum, b) => sum + b.total, 0);
  const totalSeats   = bookings.reduce((sum, b) => sum + b.seats, 0);
  statsDiv.innerHTML = `
    <div class="stat-card"><span class="stat-number">${bookings.length}</span><span class="stat-label">Total Bookings</span></div>
    <div class="stat-card"><span class="stat-number">${totalSeats}</span><span class="stat-label">Seats Sold</span></div>
    <div class="stat-card"><span class="stat-number">Rs. ${totalRevenue}</span><span class="stat-label">Total Revenue</span></div>`;

  container.innerHTML = "";
  if (bookings.length === 0) { container.innerHTML = "<p class='muted' style='margin-top:16px;'>No bookings yet.</p>"; return; }

  const table = document.createElement("table");
  table.className = "admin-table";
  table.innerHTML = `<thead><tr><th>Booking ID</th><th>User</th><th>Movie</th><th>Show Time</th><th>Seats</th><th>Total (Rs.)</th><th>Booked On</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  bookings.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>#${b.id}</td><td>${b.username}</td><td>${b.movie_title}</td><td>${b.timing || "Not specified"}</td><td>${b.seats}</td><td>${b.total}</td><td>${b.booking_date}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function renderAdminReviews() {
  const ratings   = await api("/admin/reviews");
  const container = document.getElementById("admin-reviews-list");
  container.innerHTML = "";
  if (ratings.length === 0) { container.innerHTML = "<p class='muted'>No ratings have been submitted yet.</p>"; return; }

  const grouped = {};
  ratings.forEach(r => { if (!grouped[r.movie_id]) grouped[r.movie_id] = []; grouped[r.movie_id].push(r); });

  Object.keys(grouped).forEach(movieId => {
    const movie = movies.find(m => m.id === parseInt(movieId));
    if (!movie) return;
    const movieRatings = grouped[movieId];
    const avg = (movieRatings.reduce((sum, r) => sum + r.stars, 0) / movieRatings.length).toFixed(1);
    const rows = movieRatings.map(r => `
      <div class="review-row">
        <span class="review-user">${r.username}</span>
        <span class="review-stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span>
        <span class="review-num">${r.stars} / 5</span>
      </div>`).join("");
    const card = document.createElement("div");
    card.className = "review-card";
    card.innerHTML = `<div class="review-header"><strong>${movie.title}</strong><span class="avg-badge">Avg: ${avg} / 5 (${movieRatings.length})</span></div><div class="review-rows">${rows}</div>`;
    container.appendChild(card);
  });
}

async function renderAdminTimings() {
  const select = document.getElementById("timing-movie-select");
  select.innerHTML = "";
  movies.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.title;
    select.appendChild(opt);
  });

  const container = document.getElementById("admin-timings-list");
  container.innerHTML = "";
  const allTimingRows = await Promise.all(movies.map(m => api(`/timings/${m.id}`)));

  movies.forEach((movie, i) => {
    const movieTimings = allTimingRows[i];
    const card = document.createElement("div");
    card.className = "timing-card";
    const tags = movieTimings.length > 0
      ? movieTimings.map(t => `<span class="timing-badge">${t.time_str}<button class="timing-remove-btn" onclick="removeTiming(${t.id})">x</button></span>`).join("")
      : "<span class='muted' style='font-size:0.85rem;'>No timings set</span>";
    card.innerHTML = `<div class="timing-movie-name">${movie.title}</div><div class="timing-tags-row">${tags}</div>`;
    container.appendChild(card);
  });
}

async function addTiming() {
  const movieId = parseInt(document.getElementById("timing-movie-select").value);
  const timeVal = document.getElementById("timing-input").value.trim();
  const err     = document.getElementById("timing-error");

  if (!timeVal)            { err.textContent = "Please enter a show time."; return; }
  if (timeVal.length > 20) { err.textContent = "Time value is too long."; return; }

  try {
    await api("/timings", { method: "POST", body: JSON.stringify({ movieId, timeStr: timeVal }) });
    document.getElementById("timing-input").value = "";
    err.textContent = "";
    renderAdminTimings();
  } catch (e) {
    err.textContent = e.message;
  }
}

async function removeTiming(timingId) {
  await api(`/timings/${timingId}`, { method: "DELETE" });
  renderAdminTimings();
}

// ---- NEW: ADMIN SCREENINGS PANEL ----
async function renderAdminScreenings() {
  const rows = await api("/admin/screenings");
  const container = document.getElementById("admin-screenings-list");
  container.innerHTML = "";

  if (rows.length === 0) {
    container.innerHTML = "<p class='muted'>No theater submissions yet.</p>";
    return;
  }

  rows.forEach(s => {
    const card = document.createElement("div");
    card.className = "submission-card status-" + s.status;
    card.innerHTML = `
      <div class="submission-card-header">
        <strong>${s.movie_title}</strong>
        <span class="status-badge status-${s.status}">${s.status}</span>
      </div>
      <p class="muted">Theater: ${s.theater_name} &middot; ${s.genre} &middot; Rs. ${s.price}</p>
      <p class="muted">${s.description}</p>
      <div class="submission-actions">
        <button class="btn-primary small-btn" onclick="approveScreening(${s.id})" ${s.status === "approved" ? "disabled" : ""}>Approve</button>
        <button class="admin-delete-btn" onclick="rejectScreening(${s.id})" ${s.status === "rejected" ? "disabled" : ""}>Reject</button>
      </div>`;
    container.appendChild(card);
  });
}

async function approveScreening(id) {
  await api(`/admin/screenings/${id}/approve`, { method: "POST" });
  renderAdminScreenings();
}

async function rejectScreening(id) {
  await api(`/admin/screenings/${id}/reject`, { method: "POST" });
  renderAdminScreenings();
}

// ============================================================
// INIT
// ============================================================
window.onload = function () {
  renderHome();
  showPage("home");
};
