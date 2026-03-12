/* =========================================================
   server.js — QuizAI Backend
   Updated: mysql.createConnection → createPool
             (required for transaction getConnection())
   ========================================================= */

require('dotenv').config();

const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const app  = express();
const PORT = 3000;

const JWT_SECRET  = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('❌ JWT_SECRET is not set in .env'); process.exit(1); }
const SALT_ROUNDS = 10;

app.use(express.json());
app.use(cors({
  origin:       '*',
  methods:      ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ════════════════════════════════════════════════════════
   DATABASE — pool instead of single connection
   Pool gives us:
     • getConnection() for transactions
     • automatic reconnect on drop
     • concurrent query support
════════════════════════════════════════════════════════ */
const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'edtech_quiz_db',
  charset:         'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,   // max simultaneous connections
  queueLimit:          0,   // unlimited queue
});

/* Test the pool on startup */
db.getConnection((err, conn) => {
  if (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to XAMPP MySQL! (pool)');
  conn.release();           // always release back to pool
  createUsersTable();
});

/* ════════════════════════════════════════════════════════
   USERS TABLE
════════════════════════════════════════════════════════ */
function createUsersTable() {
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(100)  NOT NULL,
      email         VARCHAR(150)  NOT NULL UNIQUE,
      password      VARCHAR(255)  NOT NULL,
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login    TIMESTAMP     NULL,
      is_active     TINYINT(1)    DEFAULT 1,
      total_quizzes INT           DEFAULT 0,
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, (err) => {
    if (err) console.error('❌ users table error:', err.message);
    else     console.log('✅ users table ready!');
  });
}

/* ════════════════════════════════════════════════════════
   AUTH HELPERS
════════════════════════════════════════════════════════ */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'লগ-ইন প্রয়োজন।' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'টোকেন মেয়াদ শেষ।' });
    }
    req.user = decoded;
    next();
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function sanitize(s) {
  return typeof s === 'string' ? s.trim().slice(0, 255) : '';
}

/* ════════════════════════════════════════════════════════
   ROUTES
════════════════════════════════════════════════════════ */

app.get('/', (req, res) =>
  res.json({ message: '🚀 QuizAI API running!', version: '2.1.0' })
);

/* ── Register ── */
app.post('/api/register', async (req, res) => {
  try {
    const name     = sanitize(req.body.name     || '');
    const email    = sanitize(req.body.email    || '').toLowerCase();
    const password = req.body.password || '';

    if (!name || name.length < 2)
      return res.status(400).json({ success: false, message: 'নাম কমপক্ষে ২ অক্ষর।', field: 'name' });
    if (!validateEmail(email))
      return res.status(400).json({ success: false, message: 'সঠিক ইমেইল দাও।', field: 'email' });
    if (!password || password.length < 6)
      return res.status(400).json({ success: false, message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।', field: 'password' });

    const [existing] = await db.promise().query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে।', field: 'email' });

    const hashed     = await bcrypt.hash(password, SALT_ROUNDS);
    const [result]   = await db.promise().query(
      'INSERT INTO users (name, email, password) VALUES (?,?,?)',
      [name, email, hashed]
    );
    const user  = { id: result.insertId, name, email };
    const token = generateToken(user);

    console.log('✅ Registered:', name, email);
    return res.status(201).json({ success: true, message: 'রেজিস্ট্রেশন সফল!', user: { ...user, token } });

  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি।' });
  }
});

/* ── Login ── */
app.post('/api/login', async (req, res) => {
  try {
    const email    = sanitize(req.body.email    || '').toLowerCase();
    const password = req.body.password || '';

    if (!validateEmail(email))
      return res.status(400).json({ success: false, message: 'সঠিক ইমেইল দাও।' });
    if (!password)
      return res.status(400).json({ success: false, message: 'পাসওয়ার্ড দাও।' });

    const [rows] = await db.promise().query(
      'SELECT id, name, email, password, is_active FROM users WHERE email = ?', [email]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'ইমেইল বা পাসওয়ার্ড ভুল।' });

    const user = rows[0];
    if (!user.is_active)
      return res.status(403).json({ success: false, message: 'অ্যাকাউন্ট নিষ্ক্রিয়।' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: 'ইমেইল বা পাসওয়ার্ড ভুল।' });

    await db.promise().query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token    = generateToken(safeUser);

    console.log('✅ Login:', user.name, email);
    return res.json({ success: true, message: 'লগ-ইন সফল!', user: { ...safeUser, token } });

  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি।' });
  }
});

/* ── Profile ── */
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT id, name, email, created_at, last_login, total_quizzes FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'পাওয়া যায়নি।' });

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি।' });
  }
});

/* ── Verify Token ── */
app.post('/api/verify-token', verifyToken, (req, res) =>
  res.json({ success: true, user: req.user })
);

/* ════════════════════════════════════════════════════════
   GROQ ROUTES (quiz generation + results)
════════════════════════════════════════════════════════ */
require('./groq-routes')(app, db, verifyToken);

/* ════════════════════════════════════════════════════════
   START
════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log('\n🚀 Server: http://localhost:' + PORT);
  console.log('📌 POST /api/register');
  console.log('📌 POST /api/login');
  console.log('📌 POST /api/generate-quiz  (Bearer token)');
  console.log('📌 POST /api/save-result    (Bearer token)');
  console.log('📌 GET  /api/my-results     (Bearer token)');
  console.log('📌 GET  /api/result/:id     (Bearer token)');
  console.log('📌 GET  /api/stats          (Bearer token)');
});