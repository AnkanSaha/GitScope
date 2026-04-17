#!/bin/bash

# Get version from manifest
VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | grep -o '"[0-9.]*"' | tr -d '"')
OUTPUT_ZIP="gitscope-v${VERSION}.zip"

# Create temporary build directory
BUILD_DIR=$(mktemp -d)

# Copy files to temp directory
cp manifest.json "$BUILD_DIR/"
cp -r icons "$BUILD_DIR/"
cp -r src "$BUILD_DIR/"

# Create zip
cd "$BUILD_DIR"
zip -r "$OLDPWD/$OUTPUT_ZIP" . -q
cd "$OLDPWD"

# Clean up temp directory
rm -rf "$BUILD_DIR"

# Output
echo "✓ $OUTPUT_ZIP"
