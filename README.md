# 🛡️ S.H.I.E.L.D. – Systematic Hostile Identification, Evaluation & Lockdown Directive

SHIELD is an **open-source Roblox moderation system** that scans group members, verifies them manually, and bans dangerous users in real time via API.

Built to help developers detect and stop:
- 🚫 ERP group members
- 💀 Exploiters
- 👥 Alt/risk accounts
- 🎯 Raiders and mass joiners

---

## 🚀 Key Features

- 🔍 **Group Scraper**: Submit group IDs and scan all members
- ✅ **Reviewer Panel**: Verify flagged users with reason tracking
- 🔨 **Auto-Ban API**: Instantly block users from your Roblox game
- 📊 **Stats & Logs**: Ban reason pie charts, review logs, and more
- 🔐 **Reviewer Login**: Uses stored accounts from `reviewers.json`
- 💾 **Self-Hosted**: Run on your own PC — no tracking, no servers

---

## 🧰 Project Structure

```
/public         → HTML, CSS, login pages, dev panel  
/data           → JSON files: bannedUsers, logs, apiKeys, etc.  
server.js       → Main backend server
scrape.js.      → Scrape script for scraping users
.env.example    → Sample environment config  
```

---

## ⚙️ Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/S.H.I.E.L.D.git
cd S.H.I.E.L.D
npm install
```

---

### 2. Configure `.env`

```bash
cp .env.example .env
```

Fill in values:

```env
PORT=3000
ADMIN_PASSWORD=[ADMINPASS]

WEBHOOK_URL=https://discord.com/api/webhooks/xxx
```

---
### (Optional) Configure The MaintenanceOn/Off.vbs
In ˋ/MaintenanceOn.vbsˋ and in ˋMaintenanceOff.vbsˋ:
add the path of the project
### 3. Add Reviewer Accounts

In `/data/reviewers.json`:

```json
[
  {
    "username": "Lime",
    "password": "toto123",
  },
  {
    "username": "Matz",
    "password": "secret123",
  }
]
```

---

## 🧪 Running SHIELD

```bash
node server.js
```
or
Run Start.vbs to run the server headless in the background
Visit `http://localhost:3000` and login via `/panel` or `/admin`.

---

## 🔌 Game Integration

Each dev can request an API key via `/request-key`.

💡 Use this Lua snippet in Roblox Studio:

```lua
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local userId = player.UserId
	local key = "YOUR_API_KEY"
	local result = HttpService:GetAsync("https://your-shield-server.com/api/isbanned/" .. userId .. "?key=" .. key)

	if result == "true" then
		player:Kick("Auto-ban: You are flagged by SHIELD.")
	end
end)
```

---

## 📊 Admin & Reviewer Routes

| Route                  | Purpose                          |
|------------------------|----------------------------------|
| `/panel`               | Review flagged users (login req)  
| `/admin`               | Admin panel  
| `/admin/keys`          | API key approvals  
| `/admin/groups`        | Manage scraped group flags  
| `/admin/stats`         | Ban stats 
| `/api/isbanned/:id`    | Used by Roblox games  
| `/api/submit-group`    | Submit group for scraping  

## 📜 License

MIT License — free for personal and dev use.  
🔒 Please do not resell or obfuscate this system.

> Please keep this project open and transparent. Credit is appreciated!

---

## 👥 Credits

Built by Mat, contributors and helpers like Limefizzdude.  
Special thanks to all SHIELD reviewers and test devs.
