import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GROUND_Y = SCREEN_HEIGHT * 0.75;
const JUMP_HEIGHT = 150;
const OBSTACLE_SPEED_INITIAL = 3;
const OBSTACLE_SPAWN_RATE = 2000; // milliseconds

// Stick Figure Component
const StickFigure = ({ y, isJumping }) => {
  const headSize = 20;
  const bodyHeight = 40;
  const legLength = 30;
  const x = SCREEN_WIDTH * 0.2;

  return (
    <View style={[styles.stickFigure, { top: y, left: x }]}>
      {/* Head */}
      <View style={[styles.head, { width: headSize, height: headSize, borderRadius: headSize / 2 }]} />
      
      {/* Body */}
      <View style={[styles.body, { 
        width: 3, 
        height: bodyHeight,
        top: headSize,
        left: headSize / 2 - 1.5
      }]} />
      
      {/* Arms */}
      <View style={[styles.arm, { 
        top: headSize + 10,
        left: headSize / 2 - 15,
        transform: [{ rotate: isJumping ? '45deg' : '0deg' }]
      }]} />
      <View style={[styles.arm, { 
        top: headSize + 10,
        left: headSize / 2 + 12,
        transform: [{ rotate: isJumping ? '-45deg' : '0deg' }]
      }]} />
      
      {/* Legs */}
      <View style={[styles.leg, { 
        top: headSize + bodyHeight,
        left: headSize / 2 - 2,
        transform: [{ rotate: isJumping ? '20deg' : '0deg' }]
      }]} />
      <View style={[styles.leg, { 
        top: headSize + bodyHeight,
        left: headSize / 2 - 1,
        transform: [{ rotate: isJumping ? '-20deg' : '0deg' }]
      }]} />
    </View>
  );
};

// Obstacle Component
const Obstacle = ({ x, height }) => {
  return (
    <View style={[styles.obstacle, { 
      left: x, 
      bottom: 0,
      height: height,
      width: 20
    }]} />
  );
};

export default function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerY, setPlayerY] = useState(GROUND_Y);
  const [isJumping, setIsJumping] = useState(false);
  const [obstacles, setObstacles] = useState([]);
  const [gameSpeed, setGameSpeed] = useState(OBSTACLE_SPEED_INITIAL);
  
  const jumpAnimation = useRef(new Animated.Value(0)).current;
  const gameLoopRef = useRef(null);
  const obstacleSpawnRef = useRef(null);
  const scoreIntervalRef = useRef(null);

  // Load high score on mount
  useEffect(() => {
    loadHighScore();
  }, []);

  const loadHighScore = async () => {
    try {
      const saved = await AsyncStorage.getItem('highScore');
      if (saved !== null) {
        setHighScore(parseInt(saved));
      }
    } catch (error) {
      console.log('Error loading high score:', error);
    }
  };

  const saveHighScore = async (newScore) => {
    try {
      await AsyncStorage.setItem('highScore', newScore.toString());
      setHighScore(newScore);
    } catch (error) {
      console.log('Error saving high score:', error);
    }
  };

  const jump = () => {
    if (gameState !== 'playing' || isJumping) return;
    
    setIsJumping(true);
    Animated.sequence([
      Animated.timing(jumpAnimation, {
        toValue: -JUMP_HEIGHT,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(jumpAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsJumping(false);
    });
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setPlayerY(GROUND_Y);
    setObstacles([]);
    setGameSpeed(OBSTACLE_SPEED_INITIAL);
    setIsJumping(false);
    jumpAnimation.setValue(0);

    // Start obstacle spawning
    obstacleSpawnRef.current = setInterval(() => {
      const obstacleHeight = Math.random() * 80 + 40;
      setObstacles(prev => [...prev, {
        id: Date.now(),
        x: SCREEN_WIDTH,
        height: obstacleHeight,
      }]);
    }, OBSTACLE_SPAWN_RATE);

    // Start score increment
    scoreIntervalRef.current = setInterval(() => {
      setScore(prev => {
        const newScore = prev + 1;
        // Increase speed every 10 points
        if (newScore % 10 === 0) {
          setGameSpeed(prevSpeed => Math.min(prevSpeed + 0.5, 10));
        }
        return newScore;
      });
    }, 100);

    // Start game loop
    gameLoopRef.current = setInterval(() => {
      updateGame();
    }, 16); // ~60fps
  };

  // Track player Y position from animation
  useEffect(() => {
    const listenerId = jumpAnimation.addListener(({ value }) => {
      setPlayerY(GROUND_Y + value);
    });
    return () => {
      jumpAnimation.removeListener(listenerId);
    };
  }, []);

  const updateGame = () => {
    // Move obstacles and check collisions
    setObstacles(prev => {
      const updated = prev.map(obs => ({
        ...obs,
        x: obs.x - gameSpeed,
      })).filter(obs => obs.x > -50);

      // Check collisions
      const playerX = SCREEN_WIDTH * 0.2;
      const playerWidth = 25;
      const playerHeight = 90;
      const currentPlayerY = playerY;
      const playerBottom = currentPlayerY + playerHeight;
      const playerTop = currentPlayerY;
      const playerRight = playerX + playerWidth;
      const playerLeft = playerX;

      updated.forEach(obs => {
        const obsLeft = obs.x;
        const obsRight = obs.x + 20;
        const obsTop = GROUND_Y - obs.height;
        const obsBottom = GROUND_Y;

        // Improved collision detection
        if (
          playerRight > obsLeft &&
          playerLeft < obsRight &&
          playerBottom > obsTop &&
          playerTop < obsBottom
        ) {
          gameOver();
        }
      });

      return updated;
    });
  };

  const gameOver = () => {
    setGameState('gameover');
    
    // Clear intervals
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (obstacleSpawnRef.current) {
      clearInterval(obstacleSpawnRef.current);
      obstacleSpawnRef.current = null;
    }
    if (scoreIntervalRef.current) {
      clearInterval(scoreIntervalRef.current);
      scoreIntervalRef.current = null;
    }

    // Update high score
    if (score > highScore) {
      saveHighScore(score);
    }
  };

  const resetGame = () => {
    setGameState('menu');
    setObstacles([]);
    setPlayerY(GROUND_Y);
    setIsJumping(false);
    jumpAnimation.setValue(0);
  };

  // Render based on game state
  if (gameState === 'menu') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>STICK RUNNER</Text>
        <Text style={styles.subtitle}>Tap to Jump!</Text>
        <Text style={styles.highScoreText}>High Score: {highScore}</Text>
        <TouchableOpacity style={styles.startButton} onPress={startGame}>
          <Text style={styles.startButtonText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gameState === 'gameover') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.gameOverTitle}>GAME OVER</Text>
        <Text style={styles.finalScore}>Score: {score}</Text>
        <Text style={styles.finalScore}>High Score: {highScore}</Text>
        <TouchableOpacity style={styles.startButton} onPress={resetGame}>
          <Text style={styles.startButtonText}>PLAY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.speedText}>Speed: {gameSpeed.toFixed(1)}x</Text>
      </View>

      {/* Game Area */}
      <TouchableOpacity 
        style={styles.gameArea} 
        activeOpacity={1}
        onPress={jump}
      >
        {/* Ground Line */}
        <View style={styles.ground} />
        
        {/* Obstacles */}
        {obstacles.map(obs => (
          <Obstacle key={obs.id} x={obs.x} height={obs.height} />
        ))}
        
        {/* Player */}
        <StickFigure y={playerY} isJumping={isJumping} />
      </TouchableOpacity>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>TAP TO JUMP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 20,
    color: '#aaa',
    marginBottom: 30,
  },
  highScoreText: {
    fontSize: 24,
    color: '#ffd700',
    marginBottom: 40,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#16213e',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  gameOverTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ff4757',
    marginBottom: 20,
    letterSpacing: 2,
  },
  finalScore: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '600',
  },
  scoreContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  speedText: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 5,
  },
  gameArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  ground: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT - GROUND_Y,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#fff',
  },
  stickFigure: {
    position: 'absolute',
    width: 30,
    height: 100,
  },
  head: {
    backgroundColor: '#fff',
    position: 'absolute',
    top: 0,
    left: 5,
  },
  body: {
    backgroundColor: '#fff',
    position: 'absolute',
  },
  arm: {
    position: 'absolute',
    width: 15,
    height: 3,
    backgroundColor: '#fff',
  },
  leg: {
    position: 'absolute',
    width: 3,
    height: 30,
    backgroundColor: '#fff',
  },
  obstacle: {
    position: 'absolute',
    backgroundColor: '#ff4757',
    borderWidth: 2,
    borderColor: '#fff',
  },
  instructions: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#aaa',
    fontSize: 16,
    letterSpacing: 2,
  },
});

