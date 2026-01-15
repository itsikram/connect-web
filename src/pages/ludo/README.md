# Ludo Game - Refactored Structure

This directory contains the refactored Ludo game code, organized into a clean, modular structure.

## Directory Structure

```
ludo/
├── constants/
│   └── gameConstants.js      # Game constants (colors, paths, safe cells, etc.)
├── utils/
│   ├── colorUtils.js         # Color manipulation utilities
│   ├── gameLogic.js          # Game logic (captures, moves, path calculations)
│   ├── gameState.js          # Game state persistence (localStorage, database)
│   └── socketHelpers.js      # Socket.io helper functions
├── components/
│   ├── AnimatedBackground.js # Animated background component
│   ├── ConnectionStatus.js   # Connection status indicator
│   ├── DiceSVG.js            # Dice SVG component
│   ├── GameBoard.js          # Main game board component
│   └── WinnerConfetti.js     # Winner celebration confetti
├── hooks/
│   └── useAudio.js           # Audio/sound effects hook
├── index.js                  # Main export
└── LudoGame.js               # Main game component (refactored)
```

## Key Improvements

1. **Separation of Concerns**: Logic, UI, and utilities are separated into different files
2. **Reusability**: Components and utilities can be easily reused or tested
3. **Maintainability**: Easier to find and modify specific functionality
4. **Readability**: Main component is cleaner and easier to understand

## Usage

Import the game component:

```javascript
import LudoGame from './pages/ludo';
// or
import LudoGame from './pages/ludo/LudoGame';
```

## Notes

- The original `LudoGame.js` file has been refactored to use these modules
- All game logic, constants, and utilities are now in separate files
- Components are self-contained and can be easily modified or replaced
