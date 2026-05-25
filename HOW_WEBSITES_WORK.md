# How Websites Work - Technical Mechanics & Workflow

## The Complete Web Workflow

### 1. User Types URL (e.g., `1.6x7.gr`)

```
User types: https://1.6x7.gr/bounce-ball/
    ↓
Browser needs to find the server
```

### 2. DNS Lookup (Domain Name Resolution)

```
Browser asks: "Where is 1.6x7.gr?"
    ↓
DNS Server responds: "IP address is 123.45.67.89"
    ↓
Browser now knows where to connect
```

**What happens:**
- Browser checks local DNS cache
- If not found, queries DNS servers
- DNS returns the IP address of your web server
- Browser connects to that IP address

### 3. TCP/IP Connection

```
Browser → Establishes connection → Web Server (1.6x7.gr)
    ↓
TCP handshake (3-way handshake)
    ↓
Secure connection (HTTPS) via SSL/TLS
    ↓
Connection established!
```

**Technical details:**
- Browser opens a TCP connection to port 443 (HTTPS) or 80 (HTTP)
- SSL/TLS encryption is negotiated
- Secure tunnel is established

### 4. HTTP Request

```
Browser sends HTTP request:
    GET /bounce-ball/ HTTP/1.1
    Host: 1.6x7.gr
    User-Agent: Mozilla/5.0...
    Accept: text/html,application/xhtml+xml...
    ↓
Request travels through internet
    ↓
Arrives at your web server
```
**Request includes:**
- Method: GET (retrieve), POST (submit), etc.
- Path: `/bounce-ball/`
- Headers: Browser info, accepted content types, cookies
- Body: (for POST requests)

### 5. Web Server Processing

Your web server (Apache, Nginx, etc.) receives the request:

```
Server receives request for: /bounce-ball/
    ↓
Server looks in file system:
    /var/www/html/bounce-ball/
    OR
    /public_html/bounce-ball/
    ↓
Server finds: index.html
    ↓
Server reads the file
```

**Server types:**
- **Apache** - Most common, uses `.htaccess` files
- **Nginx** - Fast, modern, uses config files
- **Node.js** - JavaScript server (Express, etc.)
- **PHP** - Processes PHP files before sending

### 6. Server Response

```
Server sends HTTP response:
    HTTP/1.1 200 OK
    Content-Type: text/html
    Content-Length: 5234
    Date: Mon, 01 Jan 2024 12:00:00 GMT
    ↓
    <!DOCTYPE html>
    <html>...</html>
    ↓
Response travels back through internet
    ↓
Arrives at browser
```

**Response includes:**
- Status code: 200 (OK), 404 (Not Found), 500 (Error), etc.
- Headers: Content type, size, caching info
- Body: The actual HTML content

### 7. Browser Receives & Parses HTML

```
Browser receives HTML
    ↓
Starts parsing from top to bottom
    ↓
Encounters: <link rel="stylesheet" href="styles.css">
    ↓
Browser makes NEW request: GET /bounce-ball/styles.css
    ↓
Encounters: <script src="game.js"></script>
    ↓
Browser makes NEW request: GET /bounce-ball/game.js
```

**This is why files must be in the same directory!**

### 8. Resource Loading (CSS, JS, Images)

```
For each resource (CSS, JS, images):
    ↓
Browser sends separate HTTP request
    ↓
Server responds with file
    ↓
Browser caches it (stores temporarily)
    ↓
Applies/executes it
```

**Loading order:**
1. HTML loads first
2. CSS loads (styles applied immediately)
3. JavaScript loads (executes when loaded)
4. Images load (display when ready)

### 9. JavaScript Execution

```
Browser executes game.js:
    ↓
Runs: window.addEventListener('DOMContentLoaded', ...)
    ↓
Creates game instance: new BounceBall()
    ↓
Sets up canvas, event listeners
    ↓
Starts game loop: requestAnimationFrame()
    ↓
Game is now running!
```

**JavaScript runs in browser:**
- No server involvement after initial load
- Runs in browser's JavaScript engine (V8, SpiderMonkey, etc.)
- Can manipulate DOM, handle events, draw on canvas

### 10. Game Loop (Continuous)

```
Game loop runs at ~60 FPS:
    ↓
1. Update game state (ball position, paddle, etc.)
    ↓
2. Check collisions
    ↓
3. Draw everything on canvas
    ↓
4. Request next frame
    ↓
Repeat forever (until game ends)
```

---

## Your Site's Architecture (1.6x7.gr)

### Typical Setup:

```
┌─────────────────────────────────────┐
│   User's Browser                    │
│   (Chrome, Firefox, Safari)         │
└──────────────┬──────────────────────┘
               │ HTTPS Request
               │
               ▼
┌─────────────────────────────────────┐
│   DNS Server                        │
│   (Resolves 1.6x7.gr → IP)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Web Server (1.6x7.gr)            │
│   ┌─────────────────────────────┐  │
│   │ Apache/Nginx                 │  │
│   │ Port 80 (HTTP) or 443 (HTTPS)│  │
│   └─────────────────────────────┘  │
│   ┌─────────────────────────────┐  │
│   │ File System                  │  │
│   │ /var/www/html/               │  │
│   │   └── bounce-ball/           │  │
│   │       ├── index.html         │  │
│   │       ├── game.js            │  │
│   │       └── styles.css         │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Server-Side vs Client-Side

**Server-Side (Your Web Server):**
- Serves static files (HTML, CSS, JS)
- Handles HTTP requests/responses
- Can run server-side code (PHP, Python, Node.js)
- Manages file permissions, security

**Client-Side (User's Browser):**
- Receives and displays HTML
- Applies CSS styling
- Executes JavaScript
- Handles user interactions
- Stores data (localStorage, cookies)

---

## Complete Request/Response Cycle

```
┌─────────┐
│  USER   │ Types: https://1.6x7.gr/bounce-ball/
└────┬────┘
     │
     ▼
┌─────────────────┐
│  DNS LOOKUP     │ 1.6x7.gr → IP address
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  TCP CONNECTION │ Establish secure connection
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  HTTP REQUEST   │ GET /bounce-ball/ HTTP/1.1
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  WEB SERVER     │ Finds index.html
│  (1.6x7.gr)     │ Reads file from disk
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  HTTP RESPONSE  │ Sends HTML back
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  BROWSER        │ Receives HTML
│                 │ Parses HTML
│                 │ Requests styles.css
│                 │ Requests game.js
│                 │ Executes JavaScript
│                 │ Displays game
└─────────────────┘
```

---

## Static vs Dynamic Websites

### Static Website (Like Your Game)
```
User Request → Server → File System → Return File → Browser
```
- Files are pre-written
- Same content for everyone
- Fast, simple, no database
- Your bounce-ball game is static!

### Dynamic Website
```
User Request → Server → Process Code → Query Database → Generate HTML → Browser
```
- Content generated on-the-fly
- Different for each user
- Uses databases, server-side code
- Examples: WordPress, Facebook, etc.

---

## Key Technologies in Your Game

### HTML (HyperText Markup Language)
- Structure of the page
- Defines elements (canvas, buttons, divs)
- Loaded first

### CSS (Cascading Style Sheets)
- Visual styling
- Colors, fonts, layouts
- Loaded and applied immediately

### JavaScript
- Game logic
- User interactions
- Canvas drawing
- Runs continuously (game loop)

### Canvas API
- 2D drawing surface
- Used for game graphics
- Updated 60 times per second

---

## Performance Considerations

### Caching
- Browser caches files (CSS, JS, images)
- Subsequent visits are faster
- Server sends cache headers

### Compression
- Files can be gzipped
- Reduces transfer size
- Browser automatically decompresses

### CDN (Content Delivery Network)
- Files stored on multiple servers worldwide
- Users get files from nearest server
- Faster loading times

---

## Security Aspects

### HTTPS (SSL/TLS)
- Encrypts connection
- Prevents man-in-the-middle attacks
- Required for modern websites

### CORS (Cross-Origin Resource Sharing)
- Controls which sites can access your resources
- Prevents unauthorized access

### File Permissions
- Server controls who can read files
- Prevents unauthorized access to server files

---

## Real-World Example: Loading Your Game

```
1. User types: https://1.6x7.gr/bounce-ball/
   ↓
2. DNS: 1.6x7.gr → 192.168.1.100 (example IP)
   ↓
3. Browser connects to server on port 443 (HTTPS)
   ↓
4. Browser sends: GET /bounce-ball/ HTTP/1.1
   ↓
5. Server checks: /var/www/html/bounce-ball/index.html exists
   ↓
6. Server reads file and sends back:
   HTTP/1.1 200 OK
   Content-Type: text/html
   <!DOCTYPE html>...
   ↓
7. Browser receives HTML, starts parsing
   ↓
8. Browser sees: <link href="styles.css">
   → Makes request: GET /bounce-ball/styles.css
   ↓
9. Browser sees: <script src="game.js">
   → Makes request: GET /bounce-ball/game.js
   ↓
10. Server sends both files
   ↓
11. Browser applies CSS (page looks styled)
   ↓
12. Browser executes JavaScript
   ↓
13. Game initializes, canvas is created
   ↓
14. Game loop starts running
   ↓
15. User can now play! 🎮
```

---

## Summary

**The workflow is:**
1. **DNS Resolution** - Find server IP
2. **Connection** - Establish TCP/HTTPS connection
3. **Request** - Browser asks for page
4. **Processing** - Server finds and reads file
5. **Response** - Server sends HTML
6. **Parsing** - Browser reads HTML
7. **Resource Loading** - Browser gets CSS, JS, images
8. **Rendering** - Browser displays page
9. **Execution** - JavaScript runs, game starts
10. **Interaction** - User plays, game responds

**Your game is static**, meaning:
- Files are served as-is
- No server-side processing needed
- All logic runs in browser
- Works on any web server

This is why it's so simple to deploy - just upload 3 files and it works!

