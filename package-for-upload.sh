#!/bin/bash

# Script to package bounce-ball game for direct upload to web server

echo "📦 Packaging bounce-ball game for upload..."

# Create output directory
OUTPUT_DIR="bounce-ball-upload"
mkdir -p "$OUTPUT_DIR/bounce-ball"

# Copy game files
cp bounce-ball/index.html "$OUTPUT_DIR/bounce-ball/"
cp bounce-ball/game.js "$OUTPUT_DIR/bounce-ball/"
cp bounce-ball/styles.css "$OUTPUT_DIR/bounce-ball/"

echo "✅ Files packaged in: $OUTPUT_DIR/"
echo ""
echo "📤 Upload these files to your web server:"
echo "   - $OUTPUT_DIR/bounce-ball/index.html"
echo "   - $OUTPUT_DIR/bounce-ball/game.js"
echo "   - $OUTPUT_DIR/bounce-ball/styles.css"
echo ""
echo "💡 Keep all 3 files in the same folder on your server!"

