import http.server
import urllib.parse

class GameHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/':
            self.path = '/index.html'
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            with open('index.html', 'rb') as f:
                self.wfile.write(f.read())
        elif parsed_path.path.startswith('/play'):
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'You are playing the game!')
        else:
            self.send_response(404)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Not found')

def run_server():
    server_address = ('', 8000)
    httpd = http.server.HTTPServer(server_address, GameHandler)
    print('Starting server on port 8000...')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('Stopping server...')

run_server()