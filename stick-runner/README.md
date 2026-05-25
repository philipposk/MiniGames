# Stick Runner 🏃

A minimalist, addictive stick figure action game built with React Native and Expo. Perfect for mobile devices!

## 🎮 Gameplay

- **Tap anywhere** to make your stick figure jump
- Avoid the red obstacles coming from the right
- Score increases automatically as you survive
- Game speed increases every 10 points
- Try to beat your high score!

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`

### Installation

1. Navigate to the project directory:
```bash
cd stick-runner
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Running on Your Phone

**Option 1: Expo Go App (Easiest)**
1. Install "Expo Go" from App Store (iOS) or Google Play (Android)
2. Scan the QR code shown in the terminal
3. The app will load on your phone!

**Option 2: iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option 3: Android Emulator**
```bash
npm run android
```

## 📱 Features

- ✅ Simple, addictive gameplay
- ✅ Smooth animations
- ✅ High score tracking (saved locally)
- ✅ Increasing difficulty
- ✅ Clean, minimalist design
- ✅ Works on iOS and Android
- ✅ Portrait mode optimized

## 🎯 Game Mechanics

- **Jump Height**: Fixed at 150px
- **Obstacle Speed**: Starts at 3px/frame, increases by 0.5 every 10 points
- **Obstacle Spawn Rate**: Every 2 seconds
- **Collision Detection**: Precise hitbox detection
- **Score**: Increases every 100ms while playing

## 🛠️ Tech Stack

- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform and tooling
- **AsyncStorage**: Local high score persistence
- **Animated API**: Smooth jump animations

## 📦 Building for Production

### iOS
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

Or use EAS Build (recommended):
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

## 🎨 Customization

Feel free to modify:
- Colors in `styles` object
- Game speed in constants
- Obstacle spawn rate
- Jump height
- Score increment rate

## 📄 License

Free to use and modify!

---

**Enjoy the game! Try to beat your high score! 🎮**

