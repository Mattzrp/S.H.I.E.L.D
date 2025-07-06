const fs = require('fs');
const axios = require('axios');

const pendingFile = './data/pendingUsers.json';
if (!fs.existsSync(pendingFile)) fs.writeFileSync(pendingFile, '[]');

async function getGroupName(groupId) {
  try {
    const res = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}`);
    return res.data.name || 'Unknown Group';
  } catch {
    return 'Unknown Group';
  }
}

function readJsonSafe(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

function writeJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function scrapeGroup(groupId) {
  let cursor = null;
  const allMembers = [];
  const groupName = await getGroupName(groupId);

  try {
    do {
      const url = `https://groups.roblox.com/v1/groups/${groupId}/users?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await axios.get(url);
      const users = res.data.data;

      allMembers.push(...users.map(u => ({
        userId: u.user.userId,
        username: u.user.username,
        groupId,
        groupName,
        submittedAt: new Date().toISOString(),
        reviewed: false
      })));

      cursor = res.data.nextPageCursor;
    } while (cursor);

    const existing = readJsonSafe(pendingFile);
    const newUsers = allMembers.filter(u => !existing.some(e => e.userId === u.userId));
    writeJsonSafe(pendingFile, [...existing, ...newUsers]);

    return newUsers.length;
  } catch (err) {
    console.error(`Error scraping group ${groupId}:`, err.message);
    return 0;
  }
}

module.exports = scrapeGroup;
