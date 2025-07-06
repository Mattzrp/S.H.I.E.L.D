const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const scrapeGroup = require('./scraper');

const app = express();
const PORT = 3000;

const pendingFile = './data/pendingUsers.json';
const bannedFile = './data/bannedUsers.json';
const allowedPasswords = process.env.REVIEWER_PASSWORDS?.split(',') || [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'shield-basic-secret',
  resave: false,
  saveUninitialized: false
}));

function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf-8').trim();
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.get('/login', (req, res) => {
  res.send(`
    <form method="POST" action="/login">
      <input name="password" type="password" placeholder="Enter reviewer password" />
      <button type="submit">Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (allowedPasswords.includes(password)) {
    req.session.loggedIn = true;
    res.redirect('/panel');
  } else {
    res.status(403).send('Access denied');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/panel', ensureLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.get('/api/pending', ensureLoggedIn, (req, res) => {
  const users = readJsonSafe(pendingFile);
  res.json(users);
});

app.post('/api/approve/:id', ensureLoggedIn, (req, res) => {
  const userId = parseInt(req.params.id);
  const pending = readJsonSafe(pendingFile);
  const banned = readJsonSafe(bannedFile);
  const user = pending.find(u => u.userId === userId);
  if (!user) return res.status(404).send('User not found');

  const reviewedUser = {
    ...user,
    reviewed: true,
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'Manual reviewer',
    reason: req.body.reason || 'No reason provided'
  };

  const newPending = pending.filter(u => u.userId !== userId);
  writeJsonSafe(pendingFile, newPending);
  writeJsonSafe(bannedFile, [...banned, reviewedUser]);

  res.send('Approved');
});

app.post('/api/reject/:id', ensureLoggedIn, (req, res) => {
  const userId = parseInt(req.params.id);
  const pending = readJsonSafe(pendingFile);
  const newPending = pending.filter(u => u.userId !== userId);
  writeJsonSafe(pendingFile, newPending);
  res.send('Rejected');
});

app.post('/api/submit-group', async (req, res) => {
  const groupId = parseInt(req.body.groupId);
  if (!groupId) return res.status(400).send('Invalid group ID');

  const count = await scrapeGroup(groupId);
  if (count > 0) {
    res.send(`✅ Submitted! ${count} new users added for review.`);
  } else {
    res.send(`⚠️ No new users added or group is invalid.`);
  }
});

app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.listen(PORT, () => {
  console.log(`🛡️ SHIELD running at http://localhost:${PORT}`);
});
