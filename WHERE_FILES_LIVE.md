# Where Do Your Game Files Actually Live?

## Two Different Scenarios

### Scenario 1: GitHub Pages (With Custom Domain)

**Where files physically live:** GitHub's servers

**How it works:**
```
User visits: https://1.6x7.gr/bounce-ball/
    ↓
DNS points to: GitHub Pages servers (not your server!)
    ↓
GitHub serves files from: philipposk.github.io/MiniGames/
    ↓
But user sees: 1.6x7.gr (because of custom domain)
```

**File Location:**
- Files are stored on **GitHub's servers**
- GitHub Pages hosts them at: `philipposk.github.io/MiniGames/bounce-ball/`
- Your domain (1.6x7.gr) just points to GitHub
- When user visits 1.6x7.gr, they're actually getting files from GitHub

**Pros:**
- ✅ Free hosting
- ✅ Automatic HTTPS
- ✅ Automatic updates when you push to GitHub
- ✅ No server maintenance

**Cons:**
- ❌ Files not on your server
- ❌ Depends on GitHub being available
- ❌ Limited customization

---

### Scenario 2: Direct Upload to Your Server

**Where files physically live:** Your server (1.6x7.gr)

**How it works:**
```
User visits: https://1.6x7.gr/bounce-ball/
    ↓
DNS points to: YOUR server (1.6x7.gr)
    ↓
Your server serves files from: /var/www/html/bounce-ball/
    ↓
User gets files directly from your server
```

**File Location:**
- Files are stored on **YOUR server** (1.6x7.gr)
- Physical location: `/var/www/html/bounce-ball/` (or similar)
- When user visits, they get files directly from your server
- No GitHub involved in serving files

**Pros:**
- ✅ Full control
- ✅ Files on your server
- ✅ No dependency on GitHub
- ✅ Can customize server settings

**Cons:**
- ❌ You manage hosting
- ❌ Need to manually upload updates
- ❌ Server maintenance required

---

## Visual Comparison

### GitHub Pages Setup:
```
┌─────────────────────────────────────────┐
│  User's Browser                         │
└──────────────┬──────────────────────────┘
               │
               │ Visits: 1.6x7.gr/bounce-ball/
               │
               ▼
┌─────────────────────────────────────────┐
│  DNS Server                             │
│  "1.6x7.gr points to GitHub's IP"      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  GitHub Pages Servers                   │
│  (philipposk.github.io)                 │
│  ┌───────────────────────────────────┐ │
│  │ Files stored here:                │ │
│  │ /MiniGames/bounce-ball/           │ │
│  │   ├── index.html                  │ │
│  │   ├── game.js                     │ │
│  │   └── styles.css                  │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Direct Server Upload:
```
┌─────────────────────────────────────────┐
│  User's Browser                         │
└──────────────┬──────────────────────────┘
               │
               │ Visits: 1.6x7.gr/bounce-ball/
               │
               ▼
┌─────────────────────────────────────────┐
│  DNS Server                             │
│  "1.6x7.gr points to YOUR server IP"   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  YOUR Server (1.6x7.gr)                 │
│  ┌───────────────────────────────────┐ │
│  │ Files stored here:                │ │
│  │ /var/www/html/bounce-ball/       │ │
│  │   ├── index.html                  │ │
│  │   ├── game.js                     │ │
│  │   └── styles.css                  │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## What Happens When User Visits?

### GitHub Pages (Custom Domain):
1. User types: `1.6x7.gr/bounce-ball/`
2. DNS lookup: "Where is 1.6x7.gr?" → Points to GitHub's IP
3. Browser connects to: **GitHub's servers** (not yours!)
4. GitHub serves files from their servers
5. User gets game files from GitHub
6. **Files are NOT on your server** - they're on GitHub

### Direct Upload:
1. User types: `1.6x7.gr/bounce-ball/`
2. DNS lookup: "Where is 1.6x7.gr?" → Points to YOUR server's IP
3. Browser connects to: **YOUR server** (1.6x7.gr)
4. Your server serves files from your disk
5. User gets game files from your server
6. **Files ARE on your server** - they live there

---

## The Key Difference

**GitHub Pages:**
- Files live on GitHub
- Your domain just redirects to GitHub
- GitHub serves the files
- You don't need your own server to serve files

**Direct Upload:**
- Files live on your server
- Your server serves the files
- No GitHub involved in serving
- You need your own server

---

## Which One Are You Using?

### If you set up GitHub Pages:
- Files are on **GitHub's servers**
- When user visits, files come from **GitHub**
- Your domain just points to GitHub

### If you upload directly:
- Files are on **your server** (1.6x7.gr)
- When user visits, files come from **your server**
- GitHub is only for version control (storing code)

---

## Real-World Analogy

**GitHub Pages:**
- Like renting a storage unit (GitHub)
- You put your stuff there
- When someone visits your address (1.6x7.gr), they go to the storage unit
- The stuff lives at the storage unit, not at your address

**Direct Upload:**
- Like keeping stuff in your own house (your server)
- You put your stuff in your house
- When someone visits your address (1.6x7.gr), they come to your house
- The stuff lives at your house

---

## Current Setup (Based on Your Workflow)

You have a GitHub Actions workflow that:
1. Takes files from your repository
2. Deploys them to GitHub Pages
3. Files end up on **GitHub's servers**

So if you use GitHub Pages with custom domain:
- ✅ Files live on GitHub
- ✅ Users get files from GitHub
- ✅ Your server (1.6x7.gr) is not serving the files
- ✅ Your domain just redirects to GitHub

---

## Summary

**Question: Does the game get pulled from GitHub at that moment?**

**Answer:**
- **If using GitHub Pages:** YES - files are served from GitHub's servers when user visits
- **If uploaded directly:** NO - files are served from your server (1.6x7.gr) when user visits

**The game doesn't "live" on your site if using GitHub Pages - it lives on GitHub, and your domain just points there!**

