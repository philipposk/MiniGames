#!/usr/bin/env python3
"""
Simple HTTP Server for Color Clash
Serves the game locally with proper MIME types for PWA support
"""

import http.server
import socketserver
import os
import sys

PORT = 8000

class ColorClashHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers for PWA support
        self.send_header('Cache-Control', 'no-cache')
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.json'):
            self.send_header('Content-Type', 'application/json')
        elif self.path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom logging
        print(f"[Color Clash] {args[0]}")

def main():
    # Change to the directory containing this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), ColorClashHandler) as httpd:
        print("=" * 60)
        print("🎨 COLOR CLASH - Development Server")
        print("=" * 60)
        print(f"\n✅ Server running at http://localhost:{PORT}")
        print(f"\n📱 Mobile testing:")
        print(f"   Find your IP: ifconfig | grep 'inet '")
        print(f"   Then visit: http://YOUR_IP:{PORT}")
        print(f"\n🎮 Open http://localhost:{PORT} in your browser")
        print(f"\n⚠️  Press Ctrl+C to stop the server\n")
        print("=" * 60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Thanks for playing Color Clash!")
            sys.exit(0)

if __name__ == "__main__":
    main()

