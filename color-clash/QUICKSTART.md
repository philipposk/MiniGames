# Color Clash - Quick Start Guide ⚡

Get Color Clash running in **5 minutes**!

## 🎮 Play Locally (1 minute)

### Option 1: Direct Browser (Simplest)

1. Open `index.html` directly in your browser
2. Click "TAP TO START"
3. Play!

**Note**: Service worker requires a server for PWA features.

### Option 2: Local Server (Recommended)

```bash
# Navigate to folder
cd color-clash

# Python (if installed)
python3 -m http.server 8000

# Node.js (if installed)
npx http-server -p 8000

# PHP (if installed)
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

---

## 📱 Test on Mobile (2 minutes)

1. **Start local server** (see above)

2. **Find your IP address**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

3. **On your phone** (same WiFi):
   - Open browser
   - Go to `http://YOUR_IP:8000`
   - Play the game!

4. **Add to Home Screen**:
   - **iOS**: Safari → Share → Add to Home Screen
   - **Android**: Chrome → Menu → Add to Home Screen

---

## 🎨 Generate Icons (30 seconds)

1. Open `create-icons.html` in browser
2. Click "Download 192x192"
3. Click "Download 512x512"
4. Click "Download 1024x1024"
5. Save all icons to project folder

---

## 🍎 Publish to App Store (1 week)

See **[APP_STORE_GUIDE.md](./APP_STORE_GUIDE.md)** for complete instructions.

### Super Quick Version:

```bash
# Install Capacitor
npm install

# Add iOS platform
npx cap add ios

# Open in Xcode
npx cap open ios
```

Then follow the App Store guide for configuration and submission.

---

## 🎯 How to Play

1. **TAP TO START** - Begin game
2. **WATCH** - Two colored bars slide toward center
3. **TAP** - When they overlap perfectly
4. **SCORE** - Based on color similarity and timing
   - PERFECT: +100 points
   - GOOD: +50 points
   - OKAY: +10 points
   - MISS: Game Over

---

## 🔧 Customization

### Change Difficulty (game.js)

```javascript
// Line ~15
this.baseSpeed = 3.0;  // Make faster (default: 2.5)

// Line ~90
const maxDifference = 30;  // Make easier (default: 25 - level*2)
```

### Change Colors (game.js)

```javascript
// Line ~68 - Add new color families
{ name: 'gold', baseHue: 45, range: 15 },
{ name: 'magenta', baseHue: 300, range: 20 }
```

### Change Scoring (game.js)

```javascript
// Line ~251 - Adjust point values
points = 200;  // Perfect (default: 100)
points = 100;  // Good (default: 50)
points = 25;   // Okay (default: 10)
```

---

## 📁 Project Structure

```
color-clash/
├── index.html              # Main page
├── styles.css              # All styling
├── game.js                 # Game logic
├── manifest.json           # PWA config
├── service-worker.js       # Offline support
├── create-icons.html       # Icon generator
└── *.md                    # Documentation
```

---

## ❓ Troubleshooting

### Game won't load
- Check browser console for errors
- Make sure you're using a server (not file://)
- Try a different browser

### Service worker not working
- Must use HTTPS or localhost
- Check browser DevTools → Application → Service Workers

### Icons not showing
- Generate icons using `create-icons.html`
- Save with exact filenames: `icon-192.png`, `icon-512.png`

### Mobile touch not working
- Make sure viewport meta tag is present (it is!)
- Try different device/browser
- Check for JavaScript errors

---

## 🚀 Ready to Launch?

1. ✅ Test game locally
2. ✅ Test on mobile device
3. ✅ Generate all icons
4. ✅ Read APP_STORE_GUIDE.md
5. ✅ Set up Apple Developer account
6. ✅ Submit to App Store
7. ✅ Become #1 game!

---

## 📞 Need Help?

- 📖 Read **[README.md](./README.md)** for detailed info
- 🍎 Read **[APP_STORE_GUIDE.md](./APP_STORE_GUIDE.md)** for submission
- 🐛 Check browser console for errors
- 💬 Open an issue on GitHub

---

**That's it! Now go create the most addictive game on mobile! 🎮**

