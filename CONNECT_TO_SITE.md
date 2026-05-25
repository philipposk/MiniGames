# How to Connect Bounce Ball to Your Site (1.6x7.gr)

## How the Game Works

The bounce-ball game is **100% client-side** - it runs entirely in the user's browser:

1. **index.html** - The main HTML page that loads everything
2. **styles.css** - Visual styling (loaded via `<link>` tag)
3. **game.js** - Game logic (loaded via `<script>` tag)

When a user visits your site:
- Browser downloads `index.html`
- HTML loads `styles.css` and `game.js` automatically
- JavaScript runs in the browser and creates the game
- No server-side code needed - it's pure HTML/CSS/JavaScript!

## Option 1: Connect GitHub Pages to Your Custom Domain (Recommended)

This keeps the game on GitHub but accessible via your domain (1.6x7.gr).

### Step 1: Enable GitHub Pages
1. Go to: https://github.com/philipposk/MiniGames/settings/pages
2. Under **Source**, select **GitHub Actions**
3. Save

### Step 2: Add Custom Domain
1. In the same Pages settings, under **Custom domain**, enter: `1.6x7.gr`
2. Or use a subdomain: `games.1.6x7.gr` or `bounce.1.6x7.gr`
3. GitHub will create a `CNAME` file

### Step 3: Configure DNS
In your domain's DNS settings (where you manage 1.6x7.gr), add:

**For root domain (1.6x7.gr):**
```
Type: A
Name: @
Value: 185.199.108.153
Value: 185.199.109.153
Value: 185.199.110.153
Value: 185.199.111.153
```

**OR for subdomain (games.1.6x7.gr):**
```
Type: CNAME
Name: games
Value: philipposk.github.io
```

### Step 4: Access Your Game
- After DNS propagates (5-60 minutes), visit:
- `https://1.6x7.gr/bounce-ball/` (if using root)
- OR `https://games.1.6x7.gr/bounce-ball/` (if using subdomain)

---

## Option 2: Upload Files Directly to Your Web Server

If you have FTP/SSH access to 1.6x7.gr, upload the files directly.

### Step 1: Download Game Files
The files you need:
- `bounce-ball/index.html`
- `bounce-ball/game.js`
- `bounce-ball/styles.css`

### Step 2: Upload to Your Server
Upload all 3 files to your web server, keeping them in the same folder:

**Option A: Root directory**
```
/public_html/bounce-ball/
  ├── index.html
  ├── game.js
  └── styles.css
```
Access at: `https://1.6x7.gr/bounce-ball/`

**Option B: Subdirectory**
```
/public_html/games/bounce-ball/
  ├── index.html
  ├── game.js
  └── styles.css
```
Access at: `https://1.6x7.gr/games/bounce-ball/`

### Step 3: Verify
1. Visit the URL in your browser
2. Open browser console (F12) to check for errors
3. Game should load and be playable!

---

## How It Works Technically

```
User visits: https://1.6x7.gr/bounce-ball/
    ↓
Browser requests: index.html
    ↓
index.html loads:
    - <link href="styles.css">  → Downloads CSS
    - <script src="game.js">    → Downloads JavaScript
    ↓
JavaScript runs in browser:
    - Creates canvas element
    - Sets up game loop
    - Handles user input (mouse/touch)
    - Renders graphics
    ↓
Game is playable! 🎮
```

**Key Points:**
- ✅ No server-side processing needed
- ✅ Works on any web server (Apache, Nginx, etc.)
- ✅ No database required
- ✅ High scores saved in browser's localStorage
- ✅ Works offline after first load (if cached)

---

## Troubleshooting

### Game doesn't load?
- Check browser console (F12) for errors
- Verify all 3 files are in the same directory
- Check file permissions (should be readable: 644)

### Files not found (404 errors)?
- Ensure file paths are correct
- Check that `styles.css` and `game.js` are in the same folder as `index.html`
- Verify case sensitivity (Linux servers are case-sensitive)

### Game loads but doesn't work?
- Check browser console for JavaScript errors
- Ensure JavaScript is enabled in browser
- Try clearing browser cache

---

## Quick Test

To test locally before uploading:
```bash
cd bounce-ball
python3 -m http.server 8000
```
Then visit: `http://localhost:8000`

