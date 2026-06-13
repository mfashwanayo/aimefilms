<?php
// AimeFilms PHP Backend - Complete REST API
// Endpoints: auth, movies, users, inbox, analytics, views, admin CRUD

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH);

// Normalize path (remove /backend-php prefix if present)
$base = '/backend-php';
if (str_starts_with($path, $base)) {
  $path = substr($path, strlen($base));
}
$path = '/' . ltrim($path, '/');

// ---- Config ----
$JWT_SECRET = getenv('JWT_SECRET') ?: 'dev-secret-change-me';
$DB_PATH = getenv('DB_PATH') ?: __DIR__ . '/../backend-data/aimefilms.sqlite';

// ---- Helpers ----
function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function json_response($data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function get_bearer_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!$h) return null;
  if (preg_match('/Bearer\s+(.*)$/i', $h, $m)) {
    return trim($m[1]);
  }
  return null;
}

function base64url_encode(string $s): string {
  return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function base64url_decode(string $s): string {
  $remainder = strlen($s) % 4;
  if ($remainder) {
    $padlen = 4 - $remainder;
    $s .= str_repeat('=', $padlen);
  }
  return base64_decode(strtr($s, '-_', '+/'));
}

function jwt_sign(array $payload, string $secret): string {
  $header = ['alg' => 'HS256', 'typ' => 'JWT'];
  $segments = [
    base64url_encode(json_encode($header)),
    base64url_encode(json_encode($payload))
  ];
  $signing_input = $segments[0] . '.' . $segments[1];
  $sig = hash_hmac('sha256', $signing_input, $secret, true);
  $segments[] = base64url_encode($sig);
  return implode('.', $segments);
}

function jwt_verify(string $jwt, string $secret): ?array {
  $parts = explode('.', $jwt);
  if (count($parts) !== 3) return null;
  [$h64, $p64, $s64] = $parts;
  $signing_input = $h64 . '.' . $p64;
  $sig = base64url_decode($s64);
  $expected = hash_hmac('sha256', $signing_input, $secret, true);
  if (!hash_equals($expected, $sig)) return null;
  $payload = json_decode(base64url_decode($p64), true);
  if (!is_array($payload)) return null;
  if (isset($payload['exp']) && time() > intval($payload['exp'])) return null;
  return $payload;
}

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dir = dirname($GLOBALS['DB_PATH']);
  if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
  }
  $pdo = new PDO('sqlite:' . $GLOBALS['DB_PATH']);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // Schema
  $pdo->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT "user",
    password_hash TEXT NOT NULL,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    is_verified INTEGER NOT NULL DEFAULT 1,
    language TEXT,
    joined_at TEXT NOT NULL
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT,
    section TEXT,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    highlights TEXT,
    pros TEXT,
    imageUrl TEXT,
    logoUrl TEXT,
    link TEXT,
    videoUrl TEXT,
    fullMovieUrl TEXT,
    rating TEXT,
    year TEXT,
    duration TEXT,
    cast TEXT,
    synopsis TEXT,
    isTrending INTEGER NOT NULL DEFAULT 0,
    isNew INTEGER NOT NULL DEFAULT 0,
    genre TEXT,
    matchScore REAL DEFAULT 90,
    price TEXT
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS analytics_views (
    movie_id TEXT PRIMARY KEY,
    views INTEGER NOT NULL DEFAULT 0
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    details TEXT NOT NULL,
    user_email TEXT,
    timestamp TEXT NOT NULL
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS inbox_messages (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    from_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS watchlist (
    email TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    PRIMARY KEY(email, movie_id)
  )');

  $pdo->exec('CREATE TABLE IF NOT EXISTS continue_watching (
    email TEXT NOT NULL,
    movie_id TEXT NOT NULL,
    rank INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(email, movie_id)
  )');

  // Seed master admin if missing
  $stmt = $pdo->prepare('SELECT COUNT(*) AS c FROM users WHERE email = :email');
  $stmt->execute([':email' => 'hybertmfashwanayo@gmail.com']);
  if (intval($stmt->fetch(PDO::FETCH_ASSOC)['c'] ?? 0) === 0) {
    $adminPass = getenv('ADMIN_PASSWORD') ?: '%bert123{}@';
    $ins = $pdo->prepare('INSERT INTO users (name,email,role,password_hash,joined_at,is_verified,is_blocked) VALUES (:n,:e,:r,:ph,:j,1,0)');
    $ins->execute([
      ':n' => 'hybert',
      ':e' => 'hybertmfashwanayo@gmail.com',
      ':r' => 'admin',
      ':ph' => password_hash($adminPass, PASSWORD_DEFAULT),
      ':j' => '2024-01-01T'
    ]);
  }

  return $pdo;
}

function require_auth(): array {
  $token = get_bearer_token();
  if (!$token) json_response(['success' => false, 'message' => 'Missing token'], 401);
  $payload = jwt_verify($token, $GLOBALS['JWT_SECRET']);
  if (!$payload) json_response(['success' => false, 'message' => 'Invalid token'], 401);
  return $payload;
}

function require_admin(): array {
  $payload = require_auth();
  if (($payload['role'] ?? '') !== 'admin') json_response(['success' => false, 'message' => 'Admin only'], 403);
  return $payload;
}

function log_event(string $type, string $details, ?string $email = null): void {
  $pdo = db();
  $stmt = $pdo->prepare('INSERT INTO logs (id,type,details,user_email,timestamp) VALUES (:id,:t,:d,:e,:ts)');
  $stmt->execute([
    ':id' => bin2hex(random_bytes(8)),
    ':t' => $type,
    ':d' => $details,
    ':e' => $email,
    ':ts' => date('c')
  ]);
}

function map_movie(array $r): array {
  return [
    'id' => $r['id'],
    'name' => $r['name'],
    'brand' => $r['brand'],
    'category' => $r['category'],
    'section' => $r['section'],
    'isHidden' => intval($r['is_hidden'] ?? 0) === 1,
    'description' => $r['description'],
    'highlights' => $r['highlights'] ? json_decode($r['highlights'], true) : [],
    'pros' => $r['pros'] ? json_decode($r['pros'], true) : [],
    'imageUrl' => $r['imageUrl'],
    'logoUrl' => $r['logoUrl'],
    'link' => $r['link'],
    'videoUrl' => $r['videoUrl'],
    'fullMovieUrl' => $r['fullMovieUrl'],
    'rating' => $r['rating'],
    'year' => $r['year'],
    'duration' => $r['duration'],
    'cast' => $r['cast'] ? json_decode($r['cast'], true) : [],
    'synopsis' => $r['synopsis'],
    'isTrending' => intval($r['isTrending'] ?? 0) === 1,
    'isNew' => intval($r['isNew'] ?? 0) === 1,
    'genre' => $r['genre'] ? json_decode($r['genre'], true) : [],
    'matchScore' => floatval($r['matchScore'] ?? 0),
    'price' => $r['price'],
    'logoUrl' => $r['logoUrl'],
    'link' => $r['link'],
  ];
}

// ==================== ROUTES ====================

// Health check
if ($path === '/api/health' && $method === 'GET') {
  json_response(['ok' => true, 'time' => date('c')]);
}

// ---- AUTH ----
if ($path === '/api/auth/login' && $method === 'POST') {
  $body = read_json_body();
  $identifier = (string)($body['identifier'] ?? '');
  $password = (string)($body['password'] ?? '');
  $idLower = trim(strtolower($identifier));

  $pdo = db();
  $stmt = $pdo->prepare('SELECT * FROM users WHERE lower(email)=:id OR lower(name)=:id LIMIT 1');
  $stmt->execute([':id' => $idLower]);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$u) json_response(['success' => false, 'message' => 'Identity check failed.'], 401);
  if (intval($u['is_blocked'] ?? 0) === 1) json_response(['success' => false, 'message' => 'User blocked.'], 403);

  if (!password_verify($password, $u['password_hash'])) {
    json_response(['success' => false, 'message' => 'Identity check failed.'], 401);
  }

  $payload = [
    'sub' => $u['email'],
    'role' => $u['role'],
    'name' => $u['name'],
    'email' => $u['email'],
    'exp' => time() + 60 * 60 * 6
  ];
  $jwt = jwt_sign($payload, $GLOBALS['JWT_SECRET']);

  log_event('LOGIN', $u['role'] === 'admin' ? 'Admin logged in' : 'User logged in', $u['email']);

  json_response(['success' => true, 'token' => $jwt, 'user' => [
    'name' => $u['name'],
    'email' => $u['email'],
    'role' => $u['role'],
    'isVerified' => intval($u['is_verified'] ?? 1) === 1,
    'avatar' => $u['avatar'] ?? null,
    'language' => $u['language'] ?? null,
    'joinedAt' => $u['joined_at']
  ]]);
}

if ($path === '/api/auth/register' && $method === 'POST') {
  $body = read_json_body();
  $name = (string)($body['name'] ?? '');
  $email = (string)($body['email'] ?? '');
  $password = (string)($body['password'] ?? '');

  if (!$email || !$password) json_response(['success' => false, 'message' => 'Missing fields'], 400);

  $pdo = db();
  $exists = $pdo->prepare('SELECT COUNT(*) AS c FROM users WHERE lower(email)=lower(:email)');
  $exists->execute([':email' => $email]);
  if (intval($exists->fetch(PDO::FETCH_ASSOC)['c'] ?? 0) > 0) {
    json_response(['success' => false, 'message' => 'Email is already in the registry.'], 409);
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $ins = $pdo->prepare('INSERT INTO users (name,email,role,password_hash,joined_at,is_verified,is_blocked) VALUES (:name,:email,:role,:ph,:joined,1,0)');
  $ins->execute([
    ':name' => $name ?: $email,
    ':email' => $email,
    ':role' => 'user',
    ':ph' => $hash,
    ':joined' => date('c')
  ]);

  log_event('REGISTER', 'New user registered: ' . $email, $email);
  json_response(['success' => true, 'message' => 'Success.']);
}

// ---- MOVIES (public, no auth needed for reads) ----
if ($path === '/api/movies' && $method === 'GET') {
  $pdo = db();
  $brand = $_GET['brand'] ?? null;
  $includeHidden = ($_GET['include_hidden'] ?? '') === 'true';

  $sql = 'SELECT * FROM movies WHERE (:brand IS NULL OR brand=:brand)';
  if (!$includeHidden) $sql .= ' AND is_hidden=0';
  $stmt = $pdo->prepare($sql);
  $stmt->execute([':brand' => $brand]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response(['success' => true, 'movies' => array_map('map_movie', $rows)]);
}

if ($path === '/api/movies/search' && $method === 'GET') {
  $pdo = db();
  $q = trim(strtolower((string)($_GET['q'] ?? '')));
  if (!$q) json_response(['success' => true, 'movies' => []]);

  $stmt = $pdo->prepare('SELECT * FROM movies WHERE is_hidden=0 AND lower(name) LIKE :like');
  $stmt->execute([':like' => '%' . $q . '%']);
  json_response(['success' => true, 'movies' => array_map('map_movie', $stmt->fetchAll(PDO::FETCH_ASSOC))]);
}

// ---- MOVIES admin CRUD ----
if ($path === '/api/admin/movies' && $method === 'POST') {
  require_admin();
  $b = read_json_body();
  $id = bin2hex(random_bytes(8));

  $pdo = db();
  $stmt = $pdo->prepare('INSERT INTO movies (id,name,brand,category,section,description,imageUrl,videoUrl,fullMovieUrl,rating,year,duration,synopsis,genre,cast,highlights,pros,matchScore,price,isTrending,isNew,logoUrl,link)
    VALUES (:id,:name,:brand,:cat,:sec,:desc,:img,:vid,:full,:rating,:yr,:dur,:syn,:genre,:cast,:hl,:pros,:match,:price,:trend,:new,:logo,:link)');
  $stmt->execute([
    ':id' => $id,
    ':name' => $b['name'] ?? '',
    ':brand' => $b['brand'] ?? 'aimefilms',
    ':cat' => $b['category'] ?? 'General Entertainment',
    ':sec' => $b['section'] ?? 'english',
    ':desc' => $b['description'] ?? '',
    ':img' => $b['imageUrl'] ?? '',
    ':vid' => $b['videoUrl'] ?? '',
    ':full' => $b['fullMovieUrl'] ?? '',
    ':rating' => $b['rating'] ?? '8.0',
    ':yr' => $b['year'] ?? '2024',
    ':dur' => $b['duration'] ?? '1h 30m',
    ':syn' => $b['synopsis'] ?? '',
    ':genre' => json_encode($b['genre'] ?? []),
    ':cast' => json_encode($b['cast'] ?? []),
    ':hl' => json_encode($b['highlights'] ?? []),
    ':pros' => json_encode($b['pros'] ?? []),
    ':match' => floatval($b['matchScore'] ?? 90),
    ':price' => $b['price'] ?? null,
    ':trend' => intval($b['isTrending'] ?? 0),
    ':new' => intval($b['isNew'] ?? 0),
    ':logo' => $b['logoUrl'] ?? '',
    ':link' => $b['link'] ?? ''
  ]);

  log_event('UPLOAD', 'Uploaded movie: ' . ($b['name'] ?? ''));
  json_response(['success' => true, 'movie' => ['id' => $id]], 201);
}

if (preg_match('#^/api/admin/movies/([^/]+)$#', $path, $m) && $method === 'PUT') {
  require_admin();
  $movieId = $m[1];
  $b = read_json_body();
  $pdo = db();

  $fields = ['name','brand','category','section','description','imageUrl','videoUrl','fullMovieUrl','rating','year','duration','synopsis','matchScore','price','logoUrl','link'];
  $jsonFields = ['genre','cast','highlights','pros'];
  $boolFields = ['isTrending','isNew','isHidden'];
  $sets = [];
  $params = [':id' => $movieId];

  foreach ($fields as $f) {
    if (array_key_exists($f, $b)) {
      $sets[] = "$f=:val_$f";
      $params[":val_$f"] = $b[$f];
    }
  }
  foreach ($jsonFields as $f) {
    if (array_key_exists($f, $b)) {
      $sets[] = "$f=:val_$f";
      $params[":val_$f"] = json_encode($b[$f]);
    }
  }
  foreach ($boolFields as $f) {
    if (array_key_exists($f, $b)) {
      $dbField = strtolower(preg_replace('/([A-Z])/', '_$1', $f));
      $sets[] = "$dbField=:val_$f";
      $params[":val_$f"] = intval($b[$f]);
    }
  }

  if (empty($sets)) json_response(['success' => false, 'message' => 'No fields to update'], 400);

  $sql = 'UPDATE movies SET ' . implode(',', $sets) . ' WHERE id=:id';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  log_event('UPLOAD', 'Updated movie: ' . $movieId);
  json_response(['success' => true]);
}

if (preg_match('#^/api/admin/movies/([^/]+)$#', $path, $m) && $method === 'DELETE') {
  require_admin();
  $movieId = $m[1];
  $pdo = db();
  $pdo->prepare('DELETE FROM movies WHERE id=:id')->execute([':id' => $movieId]);
  $pdo->prepare('DELETE FROM analytics_views WHERE movie_id=:id')->execute([':id' => $movieId]);
  log_event('DELETE', 'Deleted movie: ' . $movieId);
  json_response(['success' => true]);
}

// ---- VIEWS ----
if ($path === '/api/views/track' && $method === 'POST') {
  $payload = require_auth();
  $body = read_json_body();
  $movieId = (string)($body['movieId'] ?? '');
  if (!$movieId) json_response(['success' => false, 'message' => 'Missing movieId'], 400);

  $pdo = db();
  $pdo->prepare('INSERT INTO analytics_views (movie_id, views) VALUES (:id, 1) ON CONFLICT(movie_id) DO UPDATE SET views = views + 1')
    ->execute([':id' => $movieId]);

  log_event('VIEW', 'Viewed movie: ' . $movieId, $payload['email'] ?? null);
  json_response(['success' => true]);
}

if ($path === '/api/views' && $method === 'GET') {
  $pdo = db();
  $rows = $pdo->query('SELECT movie_id, views FROM analytics_views ORDER BY views DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);
  $views = [];
  foreach ($rows as $r) { $views[$r['movie_id']] = intval($r['views']); }
  json_response(['success' => true, 'views' => $views]);
}

// ---- WATCHLIST ----
if ($path === '/api/watchlist' && $method === 'GET') {
  $payload = require_auth();
  $pdo = db();
  $stmt = $pdo->prepare('SELECT movie_id FROM watchlist WHERE email=:email');
  $stmt->execute([':email' => $payload['email']]);
  json_response(['success' => true, 'watchlist' => array_map(fn($r) => $r['movie_id'], $stmt->fetchAll(PDO::FETCH_ASSOC))]);
}

if ($path === '/api/watchlist' && $method === 'POST') {
  $payload = require_auth();
  $body = read_json_body();
  $ids = $body['ids'] ?? [];
  $pdo = db();
  $pdo->prepare('DELETE FROM watchlist WHERE email=:email')->execute([':email' => $payload['email']]);
  $ins = $pdo->prepare('INSERT OR IGNORE INTO watchlist (email,movie_id) VALUES (:email,:id)');
  foreach ($ids as $id) {
    $ins->execute([':email' => $payload['email'], ':id' => $id]);
  }
  json_response(['success' => true]);
}

// ---- CONTINUE WATCHING ----
if ($path === '/api/continue-watching' && $method === 'GET') {
  $payload = require_auth();
  $pdo = db();
  $stmt = $pdo->prepare('SELECT movie_id FROM continue_watching WHERE email=:email ORDER BY rank ASC');
  $stmt->execute([':email' => $payload['email']]);
  json_response(['success' => true, 'continueWatching' => array_map(fn($r) => $r['movie_id'], $stmt->fetchAll(PDO::FETCH_ASSOC))]);
}

if ($path === '/api/continue-watching' && $method === 'POST') {
  $payload = require_auth();
  $body = read_json_body();
  $ids = $body['ids'] ?? [];
  $pdo = db();
  $pdo->prepare('DELETE FROM continue_watching WHERE email=:email')->execute([':email' => $payload['email']]);
  $ins = $pdo->prepare('INSERT OR IGNORE INTO continue_watching (email,movie_id,rank) VALUES (:email,:id,:rank)');
  foreach ($ids as $i => $id) {
    $ins->execute([':email' => $payload['email'], ':id' => $id, ':rank' => $i]);
  }
  json_response(['success' => true]);
}

// ---- INBOX / MESSAGES ----
if ($path === '/api/messages' && $method === 'POST') {
  $payload = require_auth();
  $body = read_json_body();

  $pdo = db();
  $stmt = $pdo->prepare('INSERT INTO inbox_messages (id,to_email,from_name,subject,body,timestamp,is_read) VALUES (:id,:to,:from,:sub,:body,:ts,0)');
  $stmt->execute([
    ':id' => bin2hex(random_bytes(8)),
    ':to' => $body['toEmail'] ?? $payload['email'],
    ':from' => $body['fromName'] ?? $payload['name'] ?? 'Unknown',
    ':sub' => $body['subject'] ?? 'No Subject',
    ':body' => $body['body'] ?? '',
    ':ts' => date('c')
  ]);
  log_event('MESSAGE', 'Message sent to admin', $payload['email']);
  json_response(['success' => true]);
}

if ($path === '/api/messages' && $method === 'GET') {
  $payload = require_auth();
  $pdo = db();
  $stmt = $pdo->prepare('SELECT * FROM inbox_messages WHERE to_email=:email ORDER BY timestamp DESC');
  $stmt->execute([':email' => $payload['email']]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  json_response(['success' => true, 'messages' => array_map(fn($r) => [
    'id' => $r['id'],
    'toEmail' => $r['to_email'],
    'fromName' => $r['from_name'],
    'subject' => $r['subject'],
    'body' => $r['body'],
    'timestamp' => $r['timestamp'],
    'isRead' => intval($r['is_read']) === 1
  ], $rows)]);
}

if (preg_match('#^/api/messages/([^/]+)/read$#', $path, $m) && $method === 'POST') {
  require_auth();
  $pdo = db();
  $pdo->prepare('UPDATE inbox_messages SET is_read=1 WHERE id=:id')->execute([':id' => $m[1]]);
  json_response(['success' => true]);
}

if (preg_match('#^/api/messages/([^/]+)$#', $path, $m) && $method === 'DELETE') {
  require_auth();
  $pdo = db();
  $pdo->prepare('DELETE FROM inbox_messages WHERE id=:id')->execute([':id' => $m[1]]);
  json_response(['success' => true]);
}

// ---- ADMIN: Users ----
if ($path === '/api/admin/users' && $method === 'GET') {
  require_admin();
  $pdo = db();
  $rows = $pdo->query('SELECT name,email,avatar,role,is_blocked,is_verified,language,joined_at FROM users ORDER BY joined_at DESC')->fetchAll(PDO::FETCH_ASSOC);
  json_response(['success' => true, 'users' => array_map(fn($r) => [
    'name' => $r['name'],
    'email' => $r['email'],
    'avatar' => $r['avatar'],
    'role' => $r['role'],
    'isBlocked' => intval($r['is_blocked']) === 1,
    'isVerified' => intval($r['is_verified']) === 1,
    'language' => $r['language'],
    'joinedAt' => $r['joined_at']
  ], $rows)]);
}

if (preg_match('#^/api/admin/users/([^/]+)/toggle-block$#', $path, $m) && $method === 'POST') {
  require_admin();
  $email = $m[1];
  $pdo = db();
  $stmt = $pdo->prepare('UPDATE users SET is_blocked = CASE WHEN is_blocked=1 THEN 0 ELSE 1 END WHERE email=:email');
  $stmt->execute([':email' => $email]);
  $row = $pdo->prepare('SELECT is_blocked, name FROM users WHERE email=:email')->execute([':email' => $email]);
  log_event('BLOCK', 'Toggled block for user: ' . $email);
  json_response(['success' => true]);
}

// ---- ADMIN: Analytics ----
if ($path === '/api/admin/analytics' && $method === 'GET') {
  require_admin();
  $pdo = db();
  $movies = $pdo->query('SELECT * FROM movies')->fetchAll(PDO::FETCH_ASSOC);
  $viewRows = $pdo->query('SELECT movie_id, views FROM analytics_views ORDER BY views DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC);
  $logRows = $pdo->query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20')->fetchAll(PDO::FETCH_ASSOC);
  $userRows = $pdo->query('SELECT name,email,joined_at FROM users ORDER BY joined_at DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC);
  $totalViews = $pdo->query('SELECT SUM(views) AS total FROM analytics_views')->fetch(PDO::FETCH_ASSOC);

  // Build top movies
  $topMovies = [];
  foreach ($viewRows as $vr) {
    $movie = null;
    foreach ($movies as $m) { if ($m['id'] === $vr['movie_id']) { $movie = $m; break; } }
    $topMovies[] = [
      'name' => $movie['name'] ?? 'Unknown Asset',
      'views' => intval($vr['views']),
      'id' => $vr['movie_id'],
      'brand' => $movie['brand'] ?? 'aimefilms',
      'rating' => floatval($movie['rating'] ?? 0),
      'engagement' => min(100, intval($vr['views']) * 5)
    ];
  }

  // Brand stats
  $brandMovies = ['aimefilms' => 0, 'filmsnyarwanda' => 0, 'princefilms' => 0];
  $brandViews = ['aimefilms' => 0, 'filmsnyarwanda' => 0, 'princefilms' => 0];
  foreach ($movies as $m) {
    if (isset($brandMovies[$m['brand']])) $brandMovies[$m['brand']]++;
  }
  foreach ($pdo->query('SELECT av.movie_id, av.views, m.brand FROM analytics_views av JOIN movies m ON av.movie_id=m.id')->fetchAll(PDO::FETCH_ASSOC) as $r) {
    if (isset($brandViews[$r['brand']])) $brandViews[$r['brand']] += intval($r['views']);
  }

  json_response(['success' => true, 'analytics' => [
    'topMovies' => $topMovies,
    'totalViews' => intval($totalViews['total'] ?? 0),
    'newUsers' => array_map(fn($r) => ['name' => $r['name'], 'email' => $r['email'], 'joinedAt' => $r['joined_at']], $userRows),
    'recentActivity' => array_map(fn($r) => [
      'id' => $r['id'],
      'type' => $r['type'],
      'details' => $r['details'],
      'userEmail' => $r['user_email'],
      'timestamp' => $r['timestamp']
    ], $logRows),
    'brandStats' => [
      'aimefilms' => ['views' => $brandViews['aimefilms'], 'movies' => $brandMovies['aimefilms']],
      'filmsnyarwanda' => ['views' => $brandViews['filmsnyarwanda'], 'movies' => $brandMovies['filmsnyarwanda']],
      'princefilms' => ['views' => $brandViews['princefilms'], 'movies' => $brandMovies['princefilms']]
    ]
  ]]);
}

// ---- ADMIN: Logs ----
if ($path === '/api/admin/logs' && $method === 'GET') {
  require_admin();
  $pdo = db();
  $rows = $pdo->query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC);
  json_response(['success' => true, 'logs' => array_map(fn($r) => [
    'id' => $r['id'],
    'type' => $r['type'],
    'details' => $r['details'],
    'userEmail' => $r['user_email'],
    'timestamp' => $r['timestamp']
  ], $rows)]);
}

if ($path === '/api/admin/logs' && $method === 'DELETE') {
  require_admin();
  $pdo = db();
  $pdo->exec('DELETE FROM logs');
  log_event('SYSTEM', 'All logs cleared');
  json_response(['success' => true]);
}

// ---- ADMIN: Inbox (all messages) ----
if ($path === '/api/admin/messages' && $method === 'GET') {
  require_admin();
  $pdo = db();
  $rows = $pdo->query('SELECT * FROM inbox_messages ORDER BY timestamp DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC);
  json_response(['success' => true, 'messages' => array_map(fn($r) => [
    'id' => $r['id'],
    'toEmail' => $r['to_email'],
    'fromName' => $r['from_name'],
    'subject' => $r['subject'],
    'body' => $r['body'],
    'timestamp' => $r['timestamp'],
    'isRead' => intval($r['is_read']) === 1
  ], $rows)]);
}

// ---- USER PROFILE ----
if ($path === '/api/user/profile' && $method === 'PUT') {
  $payload = require_auth();
  $body = read_json_body();
  $pdo = db();
  $stmt = $pdo->prepare('UPDATE users SET name=:name, avatar=:avatar WHERE email=:email');
  $stmt->execute([
    ':name' => $body['name'] ?? $payload['name'],
    ':avatar' => $body['avatar'] ?? null,
    ':email' => $payload['email']
  ]);
  json_response(['success' => true]);
}

// ---- SEED: populate initial movies from frontend constants ----
// The frontend calls this when the backend DB is empty,
// sending the STREAMING_SERVICES array from constants.tsx
if ($path === '/api/seed' && $method === 'POST') {
  $pdo = db();

  // Only seed if movies table is empty
  $count = intval($pdo->query('SELECT COUNT(*) AS c FROM movies')->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);
  if ($count > 0) {
    json_response(['success' => true, 'message' => 'Already seeded, skipping.', 'count' => $count]);
  }

  $body = read_json_body();
  $movies = $body['movies'] ?? [];
  $inserted = 0;

  $stmt = $pdo->prepare('INSERT OR IGNORE INTO movies (id,name,brand,category,section,description,imageUrl,videoUrl,fullMovieUrl,rating,year,duration,synopsis,genre,cast,highlights,pros,matchScore,price,isTrending,isNew,logoUrl,link)
    VALUES (:id,:name,:brand,:cat,:sec,:desc,:img,:vid,:full,:rating,:yr,:dur,:syn,:genre,:cast,:hl,:pros,:match,:price,:trend,:new,:logo,:link)');

  foreach ($movies as $m) {
    $stmt->execute([
      ':id' => $m['id'] ?? bin2hex(random_bytes(8)),
      ':name' => $m['name'] ?? '',
      ':brand' => $m['brand'] ?? 'aimefilms',
      ':cat' => $m['category'] ?? 'General Entertainment',
      ':sec' => $m['section'] ?? 'english',
      ':desc' => $m['description'] ?? '',
      ':img' => $m['imageUrl'] ?? '',
      ':vid' => $m['videoUrl'] ?? '',
      ':full' => $m['fullMovieUrl'] ?? '',
      ':rating' => $m['rating'] ?? '8.0',
      ':yr' => $m['year'] ?? '2024',
      ':dur' => $m['duration'] ?? '1h 30m',
      ':syn' => $m['synopsis'] ?? '',
      ':genre' => json_encode($m['genre'] ?? []),
      ':cast' => json_encode($m['cast'] ?? []),
      ':hl' => json_encode($m['highlights'] ?? []),
      ':pros' => json_encode($m['pros'] ?? []),
      ':match' => floatval($m['matchScore'] ?? 90),
      ':price' => $m['price'] ?? null,
      ':trend' => intval($m['isTrending'] ?? 0),
      ':new' => intval($m['isNew'] ?? 0),
      ':logo' => $m['logoUrl'] ?? '',
      ':link' => $m['link'] ?? ''
    ]);
    $inserted++;
  }

  log_event('SYSTEM', "Database seeded with $inserted movies");
  json_response(['success' => true, 'inserted' => $inserted]);
}

// ---- 404 catch-all ----
json_response(['success' => false, 'message' => 'Not found'], 404);
