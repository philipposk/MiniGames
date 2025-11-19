# Fix Mobile IP Access Issue

If you can't access the game on your phone using `http://192.168.3.16:8004`, here's how to fix it:

## Quick Fix: Disable macOS Firewall (Temporary)

1. **System Settings** → **Network** → **Firewall**
2. Turn **OFF** the firewall (temporarily for testing)
3. Try accessing `http://192.168.3.16:8004` on your phone again

## Better Solution: Allow Python Through Firewall

1. **System Settings** → **Network** → **Firewall** → **Options**
2. Click **"+"** to add an application
3. Navigate to: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
   (or wherever your Python is installed - find it with `which python3`)
4. Set it to **"Allow incoming connections"**
5. Click **OK**

## Alternative: Use Different Port

Sometimes port 8004 might be blocked. Try a different port:

```bash
# Stop current server (Ctrl+C)
# Then start on port 8080:
python3 -m http.server 8080
```

Then access: `http://192.168.3.16:8080`

## Check if Server is Accessible

On your Mac, test if the server is running:
```bash
curl http://localhost:8004
```

If that works, the server is fine - it's just the firewall blocking external access.

## Verify Same WiFi Network

Make sure your phone and Mac are on the **exact same WiFi network**:
- Same SSID (network name)
- Same router
- Phone not using cellular data

## Test Connection

On your phone's browser, try:
```
http://192.168.3.16:8004
```

If you see "This site can't be reached" or timeout:
- Firewall is blocking (use solutions above)
- Different WiFi networks
- Router blocking device-to-device communication

## Quick Test: Use ngrok (Alternative)

If firewall is too complicated, use ngrok for instant access:

```bash
# Install ngrok: brew install ngrok
# Then:
ngrok http 8004
```

This gives you a public URL like `https://abc123.ngrok.io` that works from anywhere!

---

**After fixing, refresh your phone's browser and the game should load!**

