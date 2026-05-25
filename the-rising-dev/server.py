#!/usr/bin/env python3
"""
Simple HTTP server for testing The Rising game on mobile devices.
Run this script and access the game from your phone using your computer's IP address.
"""

import http.server
import socketserver
import socket

PORT = 8000

def get_ip():
    """Get the local IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers to prevent caching during development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    ip = get_ip()
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print("=" * 60)
        print("🎮 THE RISING - Development Server")
        print("=" * 60)
        print(f"\n✅ Server running on port {PORT}\n")
        print("📱 Access from your phone:")
        print(f"   → http://{ip}:{PORT}\n")
        print("💻 Access from this computer:")
        print(f"   → http://localhost:{PORT}\n")
        print("🛑 Press Ctrl+C to stop the server")
        print("=" * 60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✋ Server stopped.")

