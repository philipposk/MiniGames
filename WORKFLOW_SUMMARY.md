# Website Workflow - Quick Summary

## The Journey of a Web Request

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: USER ACTION                      │
│  User types: https://1.6x7.gr/bounce-ball/ in browser      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 2: DNS LOOKUP                        │
│  Browser asks: "What's the IP for 1.6x7.gr?"                │
│  DNS responds: "It's 123.45.67.89"                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 3: CONNECTION                       │
│  Browser connects to server IP on port 443 (HTTPS)          │
│  Establishes secure encrypted tunnel                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 4: HTTP REQUEST                      │
│  Browser sends:                                             │
│  GET /bounce-ball/ HTTP/1.1                                 │
│  Host: 1.6x7.gr                                             │
│  User-Agent: Chrome/...                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 5: SERVER PROCESSING                │
│  Web Server (Apache/Nginx) receives request                 │
│  Looks for file: /var/www/html/bounce-ball/index.html       │
│  Reads file from disk                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 6: HTTP RESPONSE                     │
│  Server sends:                                              │
│  HTTP/1.1 200 OK                                            │
│  Content-Type: text/html                                    │
│  <!DOCTYPE html><html>...</html>                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 7: BROWSER PARSING                   │
│  Browser receives HTML                                       │
│  Reads from top to bottom                                    │
│  Finds: <link href="styles.css">                            │
│  Finds: <script src="game.js">                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 8: RESOURCE REQUESTS                  │
│  Browser automatically requests:                            │
│  → GET /bounce-ball/styles.css                              │
│  → GET /bounce-ball/game.js                                 │
│  Server sends both files                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 9: RENDERING                        │
│  Browser applies CSS → Page looks styled                     │
│  Browser executes JavaScript → Game initializes             │
│  Canvas is created → Game loop starts                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    STEP 10: GAME RUNNING                     │
│  Game loop runs at 60 FPS:                                  │
│  → Update game state                                        │
│  → Check collisions                                         │
│  → Draw on canvas                                           │
│  → Repeat forever                                           │
│                                                              │
│  User can now play! 🎮                                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. **Client-Server Model**
- **Client** (Browser) = Requests and displays
- **Server** (1.6x7.gr) = Serves files

### 2. **Request-Response Cycle**
- Every page load = New request → Response cycle
- Each resource (CSS, JS) = Separate request

### 3. **Static vs Dynamic**
- **Static** (your game): Pre-written files, same for everyone
- **Dynamic**: Generated on-the-fly, different per user

### 4. **Where Code Runs**
- **Server-side**: On your web server (serves files)
- **Client-side**: In user's browser (runs JavaScript)

## Your Game's Specific Flow

```
1. User visits: 1.6x7.gr/bounce-ball/
   ↓
2. Server sends: index.html
   ↓
3. Browser loads HTML, sees references to:
   - styles.css (line 10)
   - game.js (line 68)
   ↓
4. Browser requests both files automatically
   ↓
5. Server sends CSS and JS
   ↓
6. Browser:
   - Applies CSS → Page styled
   - Executes game.js → Game starts
   ↓
7. JavaScript creates canvas, starts game loop
   ↓
8. Game is playable!
```

## Why It Works

✅ **All files in same directory** = Relative paths work
✅ **No external dependencies** = Works offline after first load
✅ **Pure client-side** = No server processing needed
✅ **Standard web technologies** = Works on any server

## Time Breakdown (Typical)

- DNS Lookup: ~20-50ms
- Connection: ~50-200ms
- Server Processing: ~10-50ms
- File Transfer: ~50-500ms (depends on file size)
- Browser Rendering: ~50-200ms
- **Total: ~200-1000ms** (0.2-1 second)

## What Happens After Initial Load?

Once the game is loaded:
- ✅ No more server requests needed
- ✅ Everything runs in browser
- ✅ Game loop runs independently
- ✅ User interactions handled locally
- ✅ High scores saved in browser (localStorage)

The server's job is done after sending the 3 files!

