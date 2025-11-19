# The Rising - Mobile Survival Stack Game

A minimalist, emotionally-driven mobile game where you stack humans to escape rising water. Each level freezes, trapping the dead below, and survivors become builders for the next level.

## 🎮 How to Play

1. **Tap** to place humans on top of each other
2. **Stack carefully** - misaligned people will fall and drown
3. **Reach the green target line** before running out of survivors
4. **Water freezes** - some survivors escape to build the next level
5. **Climb higher** - each level gets more challenging

## 📱 Running on Mobile

### Option 1: Local Testing (Quick)
1. Open `index.html` in a browser on your computer
2. Open browser DevTools (F12)
3. Toggle device toolbar (mobile view)
4. Test the game

### Option 2: Test on Real Phone (Best)

**Using Python:**
```bash
cd the-rising
python3 -m http.server 8000
```

**Using Node.js:**
```bash
cd the-rising
npx http-server -p 8000
```

Then on your phone:
1. Make sure phone and computer are on same WiFi
2. Find your computer's IP address:
   - Mac: `System Settings > Network` or run `ifconfig | grep inet`
   - Windows: `ipconfig`
3. Open browser on phone and go to: `http://YOUR_IP:8000`
4. Bookmark it for easy access

### Option 3: Deploy to Web

**Free hosting options:**
- **Netlify**: Drag and drop the `the-rising` folder
- **Vercel**: Connect GitHub repo
- **GitHub Pages**: Push to repo and enable Pages
- **Glitch**: Import from GitHub

## 🎯 Game Mechanics

### Core Features (Current Version)
- ✅ Responsive mobile canvas (works on any screen size)
- ✅ Touch-optimized controls
- ✅ Stack physics with overlap detection
- ✅ Rising water with drowning
- ✅ Freeze mechanic between levels
- ✅ Survivor carryover system
- ✅ Named characters (some have names)
- ✅ Visual feedback (scared faces when water is close)
- ✅ Level progression (gets harder)
- ✅ Frozen layers showing previous levels

### Visual Design
- Minimalist low-poly aesthetic
- Dark, atmospheric color palette
- Red humans (living) → Gray silhouettes (frozen/dead)
- Blue water → Ice-blue frozen layers
- Named survivors for emotional connection

### Scoring
- Survivors count: How many you save
- Level reached: How high you climb
- Goal: Reach the summit before running out of people

## 🛠️ Technical Details

**Built with:**
- Pure JavaScript (no frameworks)
- HTML5 Canvas
- Mobile-first responsive design
- Device pixel ratio support (crisp on retina displays)

**Performance:**
- 60 FPS target
- Optimized for mobile browsers
- Low battery consumption
- Works offline (once loaded)

**Browser Support:**
- iOS Safari ✅
- Chrome (Android) ✅
- Firefox Mobile ✅
- Samsung Internet ✅

## 🎨 Game Design Philosophy

**Emotional Impact:**
- Every block is a person
- Named characters create attachment
- Visible consequences (frozen bodies)
- Guilt-driven replayability

**Addictive Loop:**
1. Play → Some die → Feel guilt
2. "I can save more" → Replay
3. Get better → Save more → Feel satisfaction
4. Reach new level → New challenge
5. Repeat

**Difficulty Curve:**
- Level 1: 30 people, easy height
- Level 2+: Need more people, higher climb
- Water rises faster
- Less margin for error

## 📝 Development Roadmap

### Phase 1: MVP ✅ (Current)
- Basic stacking mechanics
- Water rising and freezing
- Level progression
- Mobile responsive

### Phase 2: Enhanced Emotions
- Better character sprites
- Animations (wobbling, reaching)
- Sound effects (splashes, screams)
- Music (ambient, haunting)

### Phase 3: Advanced Mechanics
- Different human types (strong, agile, child, elderly)
- Power-ups (rope, platform, float)
- Environmental hazards (debris, waves)
- Rescue mini-game between levels

### Phase 4: Narrative
- Story mode with characters
- Why is the water rising?
- Where is the summit?
- Multiple endings

### Phase 5: Social Features
- Global leaderboard
- Share replays
- Daily challenges
- Community monument (global tower)

## 🎮 Controls

- **Tap anywhere** = Place current human
- **Orientation**: Portrait recommended
- **No buttons** = Pure tap gameplay

## 💡 Tips for Players

1. **Aim for center stacks** - easier to align
2. **Watch the scared faces** - water is getting close!
3. **Named survivors** - they've survived before, don't waste them
4. **Perfect stacks** = more survivors next level
5. **Don't rush** - better to be slow and accurate

## 🐛 Known Issues

- None currently! Please report any bugs.

## 📄 License

Free to play, modify, and share.

---

**The Rising** - *Stack the living. Remember the dead. Reach the summit.*

