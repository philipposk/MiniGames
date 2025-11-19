#!/usr/bin/env python3
"""
Simple HTTP server for Stick Runner web version
Run: python3 server.py
Then open: http://localhost:8009
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 8009

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Cache control for development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.log_date_time_string()}] {format % args}")

def main():
    # Change to the directory containing this script
    os.chdir(Path(__file__).parent)
    
    Handler = MyHTTPRequestHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/web-version.html"
        print(f"\n{'='*60}")
        print(f"🚀 Stick Runner Web Server Running!")
        print(f"{'='*60}")
        print(f"📱 Open in browser: {url}")
        print(f"📱 Or scan QR code with Expo Go for native version")
        print(f"{'='*60}\n")
        print(f"Press Ctrl+C to stop the server\n")
        
        # Try to open browser automatically
        try:
            webbrowser.open(url)
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Thanks for playing!")
            httpd.shutdown()

if __name__ == "__main__":
    main()

