# Oak Event Management - Desktop App

This folder contains the Electron wrapper to create a desktop application for Oak Event Management.

## Prerequisites

1. **Node.js 18+** installed on your computer
2. **npm** (comes with Node.js)

## Setup

```bash
cd desktop
npm install
```

## Development

To run the app locally:
```bash
npm start
```

## Building Installers

### Windows (.exe)
```bash
npm run build:win
```
Output: `dist/Oak Event Management-Setup-1.0.0.exe`

### Mac (.dmg)
```bash
npm run build:mac
```
Output: `dist/Oak Event Management-1.0.0.dmg`

### Linux (.AppImage, .deb)
```bash
npm run build:linux
```

### All Platforms
```bash
npm run build
```

## App Icons

Before building, place your app icons in the `icons/` folder:
- `icon.png` - 512x512 PNG (for Linux)
- `icon.ico` - Windows icon
- `icon.icns` - Mac icon

You can use tools like https://iconifier.net/ to generate all formats from a single PNG.

## Configuration

Edit `main.js` to change:
- `APP_URL` - The URL of your hosted Oak app
- Window dimensions
- Menu items

## Notes

- The app requires an internet connection to function
- All data is stored on the cloud server, not locally
- Updates to the web app are automatically reflected in the desktop app
