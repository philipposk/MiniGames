# 🚀 Quick Start Guide

Get your Stick Runner game running on your phone in 3 minutes!

## Step 1: Install Dependencies

```bash
cd stick-runner
npm install
```

## Step 2: Start the Server

```bash
npm start
```

This will:
- Start the Expo development server
- Show a QR code in your terminal
- Open Expo DevTools in your browser

## Step 3: Run on Your Phone

### Option A: Expo Go (Recommended - Easiest!)

1. **Install Expo Go** on your phone:
   - iOS: [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scan the QR code**:
   - **iOS**: Open Camera app and scan the QR code
   - **Android**: Open Expo Go app and tap "Scan QR code"

3. **Wait for the app to load** - it will download and run automatically!

### Option B: iOS Simulator (Mac only)

```bash
npm run ios
```

### Option C: Android Emulator

```bash
npm run android
```

## 🎮 How to Play

1. Tap **START** on the menu screen
2. **Tap anywhere** on the screen to make your stick figure jump
3. Avoid the red obstacles!
4. Your score increases automatically
5. Game gets faster every 10 points
6. Try to beat your high score!

## 🐛 Troubleshooting

### "Cannot find module 'expo'"
```bash
npm install
```

### QR code not working?
- Make sure your phone and computer are on the same WiFi network
- Try using the "Tunnel" connection type in Expo DevTools

### App won't load?
- Check that you have the latest Expo Go app
- Try restarting the server: `npm start` again
- Clear Expo cache: `expo start -c`

### Want to test without phone?
- Use iOS Simulator (Mac): `npm run ios`
- Use Android Emulator: `npm run android`

## 📱 Building for Production

When you're ready to publish:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 🎨 Customization

Edit `App.js` to customize:
- Colors (in the `styles` object)
- Game speed (`OBSTACLE_SPEED_INITIAL`)
- Jump height (`JUMP_HEIGHT`)
- Obstacle spawn rate (`OBSTACLE_SPAWN_RATE`)

---

**Enjoy your addictive stick figure game! 🎮**

