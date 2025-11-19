# Testing The Rising - Level by Level

## Files Overview

### Main Game (Full Progression)
**File:** `index.html`
- Start at Level 1
- Progress naturally through levels
- Complete experience

### Level 2 Test
**File:** `level2-test.html`
- **Starts directly at Level 2**
- Shows pre-existing frozen layer from Level 1
- 40 survivors (more than level 1)
- Higher target to reach
- Water starts above frozen layer
- See the ice with bodies below

## What's Different in Level 2?

### Visual Changes:
- 🧊 **Frozen layer visible below** - You can see the ice with frozen people/boats from Level 1
- 💧 **Water starts higher** - Begins just above the frozen layer
- 🎯 **Target is higher** - More climbing required

### Gameplay Changes:
- 👥 **More survivors** - 40 instead of 30
- ⏱️ **Same time pressure** - Water rises at same speed
- 📈 **Harder difficulty** - Need to stack higher with more people

### Emotional Impact:
- See the consequences of Level 1 frozen below you
- Building literally on top of frozen victims
- More people depending on you

## How to Test

### Test Level 1:
```bash
open index.html
```
- Play through naturally
- See how freezing works
- Experience level transition

### Test Level 2 Directly:
```bash
open level2-test.html
```
- Skip Level 1 entirely
- See what Level 2 looks like immediately
- Test with pre-existing frozen layer

## Level Progression Formula

Each level increases:
- **Survivors:** +10 per level (Level 1: 30, Level 2: 40, Level 3: 50...)
- **Target height:** -150px each level (harder to reach)
- **Visual layers:** Previous levels freeze and stack below
- **Emotional weight:** See more frozen layers = more guilt

## Expected Behavior

### Level 1 → Level 2 Transition:
1. Player reaches target in Level 1
2. Message: "WATER FREEZING..."
3. Water freezes solid (blue ice appears)
4. Message: "X SURVIVORS · LEVEL 2"
5. Survivors climb out of ice
6. Level 2 starts with those survivors + new refugees
7. Previous level visible below as frozen layer

### Level 2 Gameplay:
- Blocks spawn above frozen layer
- Water starts higher (less room)
- Need more perfect stacks (less margin for error)
- Dead bodies fall into new water (will freeze in Level 2's ice)
- When Level 2 complete → adds ANOTHER frozen layer

## Level Testing Checklist

### Level 1 (`index.html`)
- [ ] 30 survivors start
- [ ] Blocks spawn correctly
- [ ] Water rises from bottom
- [ ] Target line visible at top
- [ ] Reach target → freeze effect
- [ ] Transition to Level 2

### Level 2 (`level2-test.html`)
- [ ] Shows "LEVEL 2" in UI
- [ ] 40 survivors displayed
- [ ] Frozen layer visible below
- [ ] Ice shows frozen people/boats from Level 1
- [ ] Blocks spawn above frozen layer
- [ ] Water starts higher than Level 1
- [ ] Target is higher/harder to reach
- [ ] Can complete and move to Level 3

## Visual Reference

```
Level 1:                  Level 2:
┌─────────────┐          ┌─────────────┐
│   TARGET    │ ←         │   TARGET    │ ← Higher
├─────────────┤           ├─────────────┤
│             │           │             │
│   PLAYER    │           │   PLAYER    │
│   STACKS    │           │   STACKS    │
│    HERE     │           │    HERE     │
│             │           ├═════════════┤ ← Frozen Layer
│             │           │ ❄️ ICE ❄️   │ ← Level 1 frozen
│             │           │ 🧊 BODIES   │
├~~~~~~~~~~~~~┤ ← Water   ├~~~~~~~~~~~~~┤ ← Water starts here
│   GROUND    │           │   ICE       │
└─────────────┘          └─────────────┘
```

## Next Steps

1. **Test Level 1** - Make sure progression works
2. **Test Level 2** - Verify frozen layer appears correctly
3. **Adjust difficulty** - Tweak survivor count, water speed, target height
4. **Add Level 3** - Create level3-test.html if needed
5. **Polish transitions** - Improve freeze animation

## Notes

- Each test file is standalone (can open directly)
- Main game (`index.html`) has full progression
- Test files are for rapid iteration and visual testing
- All levels share same visual assets and code structure

