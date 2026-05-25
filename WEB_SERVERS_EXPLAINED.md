# What Are Apache and Nginx?

## Quick Answer

**Apache** and **Nginx** are **web server software** - programs that run on your server to serve web pages to visitors.

Think of them as the "waiter" at a restaurant:
- They receive requests (orders)
- They fetch files (get food from kitchen)
- They serve them to browsers (deliver to table)

---

## Apache

**Full Name:** Apache HTTP Server  
**Created:** 1995  
**Most Popular:** Yes (most widely used)

### What It Does:
- Listens for incoming web requests
- Finds the requested files on your server
- Sends them back to the browser
- Handles security, permissions, redirects

### How It Works:
```
Browser Request → Apache → Finds file → Sends file → Browser
```

### Features:
- ✅ Very mature and stable
- ✅ Lots of plugins/modules
- ✅ Works with PHP, Python, etc.
- ✅ Uses `.htaccess` files for configuration
- ✅ Great for shared hosting

### Example Configuration:
```apache
# .htaccess file
RewriteEngine On
RewriteRule ^game$ /bounce-ball/index.html
```

---

## Nginx

**Full Name:** Nginx (pronounced "engine-x")  
**Created:** 2004  
**Most Popular:** Growing fast, very popular

### What It Does:
- Same job as Apache (serves web pages)
- But designed to be faster and more efficient
- Handles many connections simultaneously

### How It Works:
```
Browser Request → Nginx → Finds file → Sends file → Browser
(Same as Apache, but faster!)
```

### Features:
- ✅ Very fast and efficient
- ✅ Handles high traffic well
- ✅ Low memory usage
- ✅ Great for modern websites
- ✅ Used by many big sites (Netflix, GitHub, etc.)

### Example Configuration:
```nginx
# nginx.conf
server {
    listen 80;
    server_name 1.6x7.gr;
    root /var/www/html;
}
```

---

## Key Differences

| Feature | Apache | Nginx |
|---------|--------|-------|
| **Age** | Older (1995) | Newer (2004) |
| **Speed** | Good | Very Fast |
| **Memory** | More memory | Less memory |
| **Configuration** | `.htaccess` files | Config files |
| **Popularity** | Most common | Growing fast |
| **Best For** | Traditional sites | High traffic sites |

---

## How They Work (Simple Explanation)

### 1. They Run on Your Server
```
Your Server (1.6x7.gr)
    ↓
Apache or Nginx is running (like a program)
    ↓
Listening on port 80 (HTTP) or 443 (HTTPS)
```

### 2. They Wait for Requests
```
User visits: 1.6x7.gr/bounce-ball/
    ↓
Apache/Nginx receives the request
    ↓
"Someone wants /bounce-ball/index.html"
```

### 3. They Find and Serve Files
```
Apache/Nginx looks in: /var/www/html/bounce-ball/
    ↓
Finds: index.html
    ↓
Reads the file
    ↓
Sends it to the browser
```

### 4. They Handle Multiple Requests
```
User 1 requests → Apache/Nginx → Serves file
User 2 requests → Apache/Nginx → Serves file
User 3 requests → Apache/Nginx → Serves file
(All at the same time!)
```

---

## Real-World Analogy

**Apache/Nginx = Restaurant Waiter**

```
Customer (Browser) → "I want the menu"
    ↓
Waiter (Apache/Nginx) → Goes to kitchen (file system)
    ↓
Finds menu (index.html)
    ↓
Brings it to customer (sends to browser)
```

---

## Which One Does Your Site Use?

Most hosting providers use:
- **Shared hosting** → Usually Apache
- **VPS/Dedicated** → You choose (Apache or Nginx)
- **Modern hosting** → Often Nginx

You can check by:
1. Looking at server response headers
2. Checking your hosting control panel
3. Asking your hosting provider

---

## Ports Explained

**Port 80 (HTTP):**
- Standard web traffic
- Not encrypted
- `http://1.6x7.gr`

**Port 443 (HTTPS):**
- Encrypted web traffic
- Secure connection
- `https://1.6x7.gr`

Apache/Nginx listen on these ports and serve files when requests come in.

---

## What They Do For Your Game

When someone visits `1.6x7.gr/bounce-ball/`:

1. **Apache/Nginx receives request**
   - "GET /bounce-ball/ HTTP/1.1"

2. **Looks for file**
   - Checks: `/var/www/html/bounce-ball/index.html`
   - File exists? ✅

3. **Sends file**
   - Reads HTML content
   - Sends: `HTTP/1.1 200 OK` + HTML

4. **Browser requests CSS/JS**
   - Browser sees: `<link href="styles.css">`
   - Browser requests: `/bounce-ball/styles.css`
   - Apache/Nginx sends CSS file
   - Same for `game.js`

5. **Done!**
   - All files served
   - Game loads in browser

---

## Summary

**Apache and Nginx are:**
- Web server software
- Programs that run on your server
- They serve files to browsers
- They handle HTTP requests/responses
- They're the "middleman" between your files and users

**Without them:**
- Your files would just sit on the server
- No one could access them
- They're essential for any website!

**Think of them as:**
- The "delivery service" for your website
- The "waiter" serving your web pages
- The "traffic controller" for web requests

---

## Technical Details

### Apache Process:
```
1. Start Apache service
2. Listen on port 80/443
3. Wait for connections
4. When request comes:
   - Parse request
   - Find file
   - Check permissions
   - Send file
5. Repeat
```

### Nginx Process:
```
1. Start Nginx service
2. Listen on port 80/443
3. Wait for connections
4. When request comes:
   - Parse request (very fast)
   - Find file (efficient)
   - Check permissions
   - Send file
5. Repeat (handles many at once)
```

Both do the same job, just differently!

