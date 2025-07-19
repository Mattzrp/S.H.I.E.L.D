const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const scrapeGroup = require('./scraper');
const { request } = require('https');
const { randomUUID } = require('crypto');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Ensure data directory exists
const suspectFile = './data/suspectGroups.json';

app.use('/data', express.static(path.join(__dirname, 'data')));

function readSuspectGroups() {
  try {
    return JSON.parse(fs.readFileSync(suspectFile));
  } catch {
    return [];
  }
}
function writeSuspectGroups(data) {
  fs.writeFileSync(suspectFile, JSON.stringify(data, null, 2));
}

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}
const logsFile = './data/logs.json';

function readLogs() {
  try {
    return JSON.parse(fs.readFileSync(logsFile));
  } catch {
    return [];
  }
}

const webhookUrl = process.env.DISCORD_WEBHOOK;

function sendWebhook(content) {
  if (!webhookUrl) return;

  axios.post(webhookUrl, { content })
    .catch(err => console.error('❌ Failed to send webhook:', err.message));
}

function validateApiKey(req, res, next) {
  const key = req.query.key || req.headers['x-api-key'];
  const keys = readApiKeys().approved;
  const valid = keys.find(k => k.key === key);

  if (!valid) return res.status(403).json({ error: 'Invalid API key' });
  next();
}

const apiKeysFile = './data/apiKeys.json';

function readApiKeys() {
  try {
    return JSON.parse(fs.readFileSync(apiKeysFile));
  } catch {
    return { pending: [], approved: [] };
  }
}

function writeApiKeys(data) {
  fs.writeFileSync(apiKeysFile, JSON.stringify(data, null, 2));
}





function writeLogEntry(entry) {
  const logs = readLogs();
  logs.push(entry);
  fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
}
const reviewersFile = './data/reviewers.json';

function readReviewers() {
  try {
    return JSON.parse(fs.readFileSync(reviewersFile));
  } catch {
    return [];
  }
}

function writeReviewers(data) {
  fs.writeFileSync(reviewersFile, JSON.stringify(data, null, 2));
}

const pendingFile = './data/pendingUsers.json';
const bannedFile = './data/bannedUsers.json';

// Initialize empty files if they don't exist
if (!fs.existsSync(pendingFile)) fs.writeFileSync(pendingFile, '[]');
if (!fs.existsSync(bannedFile)) fs.writeFileSync(bannedFile, '[]');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.use((req, res, next) => {
  if (fs.existsSync('./maintenance.lock') && !req.url.startsWith('/login','/submit','/admin-login')) {
    return res.sendFile(__dirname + '/public/maintenance.html');
  }
  next();
});
// Helper functions
function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next(); // user is logged in
  }
  res.redirect('/login'); // not logged in → go to login
}

// Auth middleware
function ensureLoggedIn(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
}

// Routes

function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin-login');
}

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/panel/stats', ensureLoggedIn, (req, res) => {
  const logs = readJsonSafe('./data/logs.json'); // ✅ correct location now
  const stats = {};

  for (const entry of logs) {
    const reviewer = entry.by || 'unknown';
    if (!stats[reviewer]) {
      stats[reviewer] = { approved: 0, denied: 0, autobanned: 0 };
    }

    if (entry.action === 'approve') stats[reviewer].approved++;
    else if (entry.action === 'deny') stats[reviewer].denied++;
    else if (entry.action === 'auto-ban') stats[reviewer].autobanned++;
  }

  res.sendFile(__dirname + '/public/reviewer-stats.html');
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin-login', (req, res) => {
  if (req.body.adminpass === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.status(403).send('Invalid admin password');
  }
});

app.get('/admin', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/request-key', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'request-key.html'))
});
app.post('/admin/add', ensureAdmin, (req, res) => {
  const { username, passcode } = req.body;
  if (!username || !passcode) {
    return res.status(400).send('Missing username or passcode');
  }

  const reviewers = readReviewers();

  if (reviewers.find(r => r.passcode === passcode)) {
    return res.status(400).send('Passcode already exists');
  }

  reviewers.push({ username, passcode });
  writeReviewers(reviewers);
  res.redirect('/admin'); // Redirect back to admin panel
});
app.get('/admin/groups', ensureAdmin, (req, res) => {
  const suspects = readSuspectGroups().filter(g => g.status === 'pending');

  const html = `
    <h1>🚨 Suspect Groups</h1>
    <a href="/admin"><button>← Back</button></a>
    <ul>
      ${suspects.map((g, i) => `
        <li>
          <b>Group ID:</b> ${g.groupId}<br>
          🚷 Banned users in group: ${g.knownBanned}<br>
          🧾 Reason: ${g.reason}<br>
          🕵️ Flagged by: ${g.flaggedBy}<br>
          <form method="POST" action="/admin/groups/approve">
            <input type="hidden" name="groupId" value="${g.groupId}">
            <button>✅ Approve & Ban Members</button>
          </form>
          <form method="POST" action="/admin/groups/reject">
            <input type="hidden" name="groupId" value="${g.groupId}">
            <button>❌ Reject</button>
          </form>
        </li>
      `).join('')}
    </ul>`;
  res.send(html);
});

app.get('/admin/stats', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.post('/login', (req, res) => {
  const reviewers = readReviewers();
  const user = reviewers.find(r => r.passcode === req.body.password);

  if (user) {
    req.session.loggedIn = true;
    req.session.username = user.username;
    res.redirect('/panel');
  } else {
    res.status(403).send('Access denied');
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API Endpoints
app.get('/admin/keys', ensureAdmin, (req, res) => {
  const keys = readApiKeys();

  const html = `
    <h1>API Key Requests</h1>
    <a href="/admin"><button>← Back to Admin</button></a>
    <h2>Pending</h2>
    <ul>
      ${keys.pending.map((r, i) => `
        <li>
          <b>${r.project}</b> – ${r.contact} – requested ${new Date(r.requestedAt).toLocaleString()}
          <form method="POST" action="/admin/approve-key" style="display:inline;">
            <input type="hidden" name="index" value="${i}">
            <button>Approve</button> <button href="/admin/decline-key"
          </form>
        </li>
      `).join('')}
    </ul>
  `;
  res.send(html);
});

app.post('/admin/approve-key', ensureAdmin, (req, res) => {
  const keys = readApiKeys();
  const i = parseInt(req.body.index);
  const request = keys.pending.splice(i, 1)[0];
  const apiKey = randomUUID();

  keys.approved.push({
    project: request.project,
    contact: request.contact,
    key: apiKey,
    approvedAt: new Date().toISOString()
  });

  writeApiKeys(keys);
  res.redirect('/admin/keys');
});

app.post('/request-key', (req, res) => {
  const { project, contact } = req.body;
  const keys = readApiKeys();
  keys.pending.push({ project, contact, requestedAt: new Date().toISOString() });
  writeApiKeys(keys);
  res.send('✅ Request submitted! An admin will review it soon.');
  sendWebhook(`🔑NEW API REQUEST FROM ${contact} FOR GAME ${project}`,`APIREQUEST`)
});

app.post('/admin/groups/approve', ensureAdmin, async (req, res) => {
  const groupId = parseInt(req.body.groupId);
  const suspects = readSuspectGroups();
  const group = suspects.find(g => g.groupId === groupId);

  if (!group) return res.status(404).send('Group not found');

  group.status = 'approved';
  writeSuspectGroups(suspects);

  try {
    // Step 1: Scrape all members of the group
    await scrapeGroup(groupId);

    // Step 2: Load users from pending and banned
    const pending = readJsonSafe(pendingFile);
    const banned = readJsonSafe(bannedFile);

    // Step 3: Find users from the approved group
    const fromGroup = pending.filter(u => u.groupId === groupId);

    // Step 4: Mark them as banned
    const reviewedAt = new Date().toISOString();
    const newBans = fromGroup.map(u => ({
      ...u,
      reviewed: true,
      reviewedBy: 'auto',
      reviewedAt,
      reason: 'Auto-ban from approved suspect group'
    })).filter(u => !banned.some(b => b.userId === u.userId));

    // Step 5: Update banned.json
    const updatedBans = [...banned, ...newBans];
    fs.writeFileSync(bannedFile, JSON.stringify(updatedBans, null, 2));

    // Step 6: Remove those users from pending.json
    const stillPending = pending.filter(u => u.groupId !== groupId);
    fs.writeFileSync(pendingFile, JSON.stringify(stillPending, null, 2));

    // Step 7: Add log entries
    const newLogs = newBans.map(u => ({
      userId: u.userId,
      username: u.username,
      action: 'auto-ban',
      reviewedBy: 'auto',
      reviewedAt,
      reason: u.reason
    }));

    // Step 8: Send webhook
    sendWebhook(`⚠️ Group ${groupId} approved as malicious.\n🔨 ${newBans.length} users auto-banned.`, 'review');

    res.redirect('/admin/groups');
  } catch (err) {
    console.error('❌ Group scraping or banning failed:', err.message);
    sendWebhook(`❌ Failed to scrape/ban users from Group ${groupId}`, 'review');
    res.status(500).send('Something went wrong during group approval.');
  }
});

app.post('/admin/groups/reject', ensureAdmin, (req, res) => {
  const groupId = parseInt(req.body.groupId);
  const suspects = readSuspectGroups();
  const group = suspects.find(g => g.groupId === groupId);
  if (!group) return res.status(404).send('Group not found');

  group.status = 'rejected';
  writeSuspectGroups(suspects);
  res.redirect('/admin/groups');
});


app.get('/api/ban-stats', ensureAdmin, (req, res) => {
  const logs = readLogs();
  const reasonCounts = {};

  for (const entry of logs) {
    if (entry.action !== 'approve') continue;
    const reason = entry.reason || 'Unknown';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  res.json(reasonCounts);
});
app.get('/api/pending', ensureLoggedIn, (req, res) => {
  res.json(readJsonSafe(pendingFile));
});

app.get('/api/reviewers', ensureAdmin, (req, res) => {
  const reviewers = readReviewers();
  res.json(reviewers);
});

app.post('/api/approve/:id', ensureLoggedIn, async (req, res) => {
  const userId = parseInt(req.params.id);
  const pending = readJsonSafe(pendingFile);
  const banned = readJsonSafe(bannedFile);

  const userIndex = pending.findIndex(u => u.userId === userId);
  if (userIndex === -1) return res.status(404).send('User not found');

  const [user] = pending.splice(userIndex, 1);
  user.reviewedAt = new Date().toISOString();
  user.reviewedBy = req.session.username || 'admin';
  user.reason = req.body.reason || 'ERP group association';
  user.reviewed = true;

  banned.push(user);
  fs.writeFileSync(bannedFile, JSON.stringify(banned, null, 2));
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  // ✅ Log the action
  writeLogEntry({
    action: 'approve',
    by: user.reviewedBy,
    userId: user.userId,
    username: user.username,
    groupId: user.groupId,
    groupName: user.groupName,
    reason: user.reason,
    time: new Date().toISOString()
  });
  sendWebhook(`✅ **[Reviewer] ${user.reviewedBy}** approved **${user.username}** (ID: ${user.userId}) from group **${user.groupName}**\n📝 Reason: ${user.reason}`);
  // Scan user groups
const groupRes = await axios.get(`https://groups.roblox.com/v2/users/${user.userId}/groups/roles`);
const groups = groupRes.data.data.map(g => g.group.id);
const suspectGroups = readSuspectGroups();

for (const groupId of groups) {
  const members = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/users?limit=100`);
  const knownBanned = members.data.data.filter(u => banned.some(b => b.userId === u.user.userId));

  if (knownBanned.length >= 3 && !suspectGroups.some(g => g.groupId === groupId)) {
    suspectGroups.push({
      groupId,
      flaggedBy: user.userId,
      reason: 'Group shared by multiple banned users',
      flaggedAt: new Date().toISOString(),
      knownBanned: knownBanned.length,
      status: 'pending'
    });
  }
}

writeSuspectGroups(suspectGroups);

  res.json({ success: true });
});


app.post('/api/reject/:id', ensureLoggedIn, (req, res) => {
  const userId = parseInt(req.params.id);
  const pending = readJsonSafe(pendingFile);

  const userIndex = pending.findIndex(u => u.userId === userId);
  if (userIndex === -1) return res.status(404).send('User not found');

  const [user] = pending.splice(userIndex, 1);
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  writeLogEntry({
    action: 'deny',
    by: req.session.username || 'admin',
    userId: user.userId,
    username: user.username,
    groupId: user.groupId,
    groupName: user.groupName,
    reason: '',
    time: new Date().toISOString()
  });
  sendWebhook(`❌ **[Reviewer] ${req.session.username || 'admin'}** denied **${user.username}** (ID: ${user.userId}) from group **${user.groupName}**`);
  res.json({ success: true });
});

app.post('/api/submit-group', async (req, res) => {
  const groupId = parseInt(req.body.groupId);
  if (!groupId || isNaN(groupId)) return res.status(400).json({ error: 'Invalid group ID' });

  try {
    const count = await scrapeGroup(groupId);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/is-banned/:userId', validateApiKey, (req, res) => {
  const banned = readJsonSafe(bannedFile);
  const userId = parseInt(req.params.userId);
  const user = banned.find(u => u.userId === userId);

  if (user) {
    sendWebhook(`🚫 **${user.username}** (ID: ${user.userId}) tried to join a game and is **banned**.\n🧾 Reason: ${user.reason}`);
    return res.json({ banned: true, reason: user.reason, username: user.username });
  } else {
    return res.json({ banned: false });
  }
});

// Frontend routes
app.get('/panel', ensureLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.get('/submit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

app.listen(PORT, () => {
  console.log(`🛡️ SHIELD running on http://localhost:${PORT}`);
});