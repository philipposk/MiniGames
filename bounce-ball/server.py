#!/usr/bin/env python3
"""
Simple HTTP Server for Bounce Ball
Serves the game locally with proper MIME types
"""

import http.server
import socketserver
import os
import sys

PORT = 8000

class BounceBallHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers for proper content types
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
        print(f"[Bounce Ball] {args[0]}")

def main():
    # Change to the directory containing this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), BounceBallHandler) as httpd:
        print("=" * 60)
        print("⚽ BOUNCE BALL - Development Server")
        print("=" * 60)
        print(f"\n✅ Server running at http://localhost:{PORT}")
        print(f"\n🎮 Open http://localhost:{PORT} in your browser")
        print(f"\n⚠️  Press Ctrl+C to stop the server\n")
        print("=" * 60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Thanks for playing Bounce Ball!")
            sys.exit(0)

if __name__ == "__main__":
    main()

