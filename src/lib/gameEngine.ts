import { GameState, DinoState, Obstacle, Cloud } from './gameTypes';
import { GAME_CONFIG, SPRITE_CONFIG } from './gameConfig';
import { audioManager } from './audioManager';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState;
  private dinoState: DinoState;
  private obstacles: Obstacle[] = [];
  private clouds: Cloud[] = [];
  private keys: Set<string> = new Set();
  private lastTime: number = 0;
  private nextObstacleDistance: number = 0;
  private animationId: number = 0;
  private isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.gameState = {
      state: 'MENU',
      score: 0,
      highScore: parseInt(localStorage.getItem('dino-high-score') || '0'),
      speed: GAME_CONFIG.game.initialSpeed,
      groundX: 0,
    };

    this.dinoState = {
      x: GAME_CONFIG.dino.x,
      y: GAME_CONFIG.dino.groundY,
      velocityY: 0,
      state: 'RUNNING',
      animationFrame: 0,
      animationTimer: 0,
    };

    this.setupEventListeners();
    this.generateInitialClouds();
    this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance;
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      this.handleInput(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener('click', () => {
      this.handleInput('Space');
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleInput('Space');
    });
  }

  private handleInput(code: string) {
    audioManager.resumeContext();

    if (this.gameState.state === 'MENU' || this.gameState.state === 'GAME_OVER') {
      if (code === 'Space') {
        this.startGame();
      }
    } else if (this.gameState.state === 'PLAYING') {
      if (code === 'Space' && this.dinoState.state !== 'JUMPING') {
        this.jump();
      } else if (code === 'ArrowDown') {
        this.duck();
      }
    }
  }

  private startGame() {
    this.gameState.state = 'PLAYING';
    this.gameState.score = 0;
    this.gameState.speed = GAME_CONFIG.game.initialSpeed;
    this.gameState.groundX = 0;
    
    this.dinoState.x = GAME_CONFIG.dino.x;
    this.dinoState.y = GAME_CONFIG.dino.groundY;
    this.dinoState.velocityY = 0;
    this.dinoState.state = 'RUNNING';
    this.dinoState.animationFrame = 0;
    this.dinoState.animationTimer = 0;

    this.obstacles = [];
    this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance;
  }

  private jump() {
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.velocityY = GAME_CONFIG.dino.jumpForce;
      this.dinoState.state = 'JUMPING';
      audioManager.playSound('jump', 0.3);
    }
  }

  private duck() {
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.state = 'DUCKING';
    }
  }

  private generateInitialClouds() {
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * GAME_CONFIG.canvas.width,
        y: 20 + Math.random() * 60,
        speed: 0.5 + Math.random() * 1,
      });
    }
  }

  private updateDino(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Handle ducking
    if (!this.keys.has('ArrowDown') && this.dinoState.state === 'DUCKING') {
      this.dinoState.state = 'RUNNING';
    }

    // Apply gravity
    this.dinoState.velocityY += GAME_CONFIG.dino.gravity;
    if (this.dinoState.velocityY > GAME_CONFIG.dino.maxFallSpeed) {
      this.dinoState.velocityY = GAME_CONFIG.dino.maxFallSpeed;
    }

    // Update position
    this.dinoState.y += this.dinoState.velocityY;

    // Ground collision
    if (this.dinoState.y >= GAME_CONFIG.dino.groundY) {
      this.dinoState.y = GAME_CONFIG.dino.groundY;
      this.dinoState.velocityY = 0;
      if (this.dinoState.state === 'JUMPING') {
        this.dinoState.state = 'RUNNING';
      }
    }

    // Animation
    this.dinoState.animationTimer += deltaTime;
    const frameTime = SPRITE_CONFIG.dino[this.dinoState.state.toLowerCase() as keyof typeof SPRITE_CONFIG.dino].frameTime;
    if (frameTime > 0 && this.dinoState.animationTimer >= frameTime) {
      this.dinoState.animationTimer = 0;
      this.dinoState.animationFrame = (this.dinoState.animationFrame + 1) % 
        SPRITE_CONFIG.dino[this.dinoState.state.toLowerCase() as keyof typeof SPRITE_CONFIG.dino].frames;
    }
  }

  private updateObstacles(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Move existing obstacles
    this.obstacles = this.obstacles.filter(obstacle => {
      obstacle.x -= this.gameState.speed;
      return obstacle.x + obstacle.width > 0;
    });

    // Generate new obstacles
    this.nextObstacleDistance -= this.gameState.speed;
    if (this.nextObstacleDistance <= 0) {
      this.generateObstacle();
      this.nextObstacleDistance = GAME_CONFIG.obstacles.minDistance + 
        Math.random() * (GAME_CONFIG.obstacles.maxDistance - GAME_CONFIG.obstacles.minDistance);
    }
  }

  private generateObstacle() {
    const types: Obstacle['type'][] = ['CACTUS_SMALL', 'CACTUS_LARGE', 'BIRD_HIGH', 'BIRD_LOW'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let obstacle: Obstacle;

    switch (type) {
      case 'CACTUS_SMALL':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - SPRITE_CONFIG.obstacles.cactus_small.height,
          width: SPRITE_CONFIG.obstacles.cactus_small.width,
          height: SPRITE_CONFIG.obstacles.cactus_small.height,
          type,
        };
        break;
      case 'CACTUS_LARGE':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - SPRITE_CONFIG.obstacles.cactus_large.height,
          width: SPRITE_CONFIG.obstacles.cactus_large.width,
          height: SPRITE_CONFIG.obstacles.cactus_large.height,
          type,
        };
        break;
      case 'BIRD_HIGH':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - 80,
          width: SPRITE_CONFIG.obstacles.bird.width,
          height: SPRITE_CONFIG.obstacles.bird.height,
          type,
        };
        break;
      case 'BIRD_LOW':
        obstacle = {
          x: GAME_CONFIG.canvas.width,
          y: GAME_CONFIG.ground.y - 40,
          width: SPRITE_CONFIG.obstacles.bird.width,
          height: SPRITE_CONFIG.obstacles.bird.height,
          type,
        };
        break;
    }

    this.obstacles.push(obstacle);
  }

  private updateClouds() {
    if (this.gameState.state !== 'PLAYING') return;

    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x + SPRITE_CONFIG.clouds.width < 0) {
        cloud.x = GAME_CONFIG.canvas.width + Math.random() * 200;
        cloud.y = 20 + Math.random() * 60;
      }
    });
  }

  private updateGame(deltaTime: number) {
    if (this.gameState.state !== 'PLAYING') return;

    // Update score
    this.gameState.score += 0.1;

    // Increase speed
    if (Math.floor(this.gameState.score) % GAME_CONFIG.game.speedIncreaseInterval === 0) {
      this.gameState.speed = Math.min(this.gameState.speed + GAME_CONFIG.game.speedIncrease, 15);
    }

    // Update ground position
    this.gameState.groundX -= this.gameState.speed;
    if (this.gameState.groundX <= -24) {
      this.gameState.groundX = 0;
    }

    // Check collisions
    this.checkCollisions();

    // Play score sound every 100 points
    if (Math.floor(this.gameState.score) % 100 === 0 && this.gameState.score > 0) {
      audioManager.playSound('score', 0.2);
    }
  }

  private checkCollisions() {
    const dinoRect = {
      x: this.dinoState.x + 5,
      y: this.dinoState.y + 5,
      width: GAME_CONFIG.dino.width - 10,
      height: this.dinoState.state === 'DUCKING' ? GAME_CONFIG.dino.duckHeight - 10 : GAME_CONFIG.dino.height - 10,
    };

    for (const obstacle of this.obstacles) {
      const obstacleRect = {
        x: obstacle.x + 3,
        y: obstacle.y + 3,
        width: obstacle.width - 6,
        height: obstacle.height - 6,
      };

      if (this.isColliding(dinoRect, obstacleRect)) {
        this.gameOver();
        return;
      }
    }
  }

  private isColliding(rect1: any, rect2: any): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }

  private gameOver() {
    this.gameState.state = 'GAME_OVER';
    this.dinoState.state = 'DEAD';
    audioManager.playSound('hit', 0.5);

    // Update high score
    const score = Math.floor(this.gameState.score);
    if (score > this.gameState.highScore) {
      this.gameState.highScore = score;
      localStorage.setItem('dino-high-score', score.toString());
    }
  }

  private render() {
    // Clear canvas with gradient sky
    const gradient = this.ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.canvas.height);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue
    gradient.addColorStop(0.7, '#98FB98'); // Light green
    gradient.addColorStop(1, '#90EE90'); // Light green
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    // Draw clouds
    this.renderClouds();

    // Draw ground
    this.renderGround();

    // Draw obstacles
    this.renderObstacles();

    // Draw dino
    this.renderDino();

    // Draw UI
    this.renderUI();
  }

  private renderClouds() {
    this.clouds.forEach(cloud => {
      // White fluffy clouds with shadow
      this.ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'; // Shadow
      this.ctx.beginPath();
      this.ctx.arc(cloud.x + 2, cloud.y + 2, 8, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 14, cloud.y + 2, 12, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 26, cloud.y + 2, 8, 0, Math.PI * 2);
      this.ctx.fill();

      // White cloud
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(cloud.x, cloud.y, 8, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 12, cloud.y, 12, 0, Math.PI * 2);
      this.ctx.arc(cloud.x + 24, cloud.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private renderGround() {
    // Ground gradient
    const groundGradient = this.ctx.createLinearGradient(0, GAME_CONFIG.ground.y, 0, GAME_CONFIG.canvas.height);
    groundGradient.addColorStop(0, '#8B4513'); // Saddle brown
    groundGradient.addColorStop(0.3, '#A0522D'); // Sienna
    groundGradient.addColorStop(1, '#D2691E'); // Chocolate
    this.ctx.fillStyle = groundGradient;
    this.ctx.fillRect(0, GAME_CONFIG.ground.y, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height - GAME_CONFIG.ground.y);

    // Ground line
    this.ctx.fillStyle = '#654321';
    this.ctx.fillRect(0, GAME_CONFIG.ground.y, GAME_CONFIG.canvas.width, 3);

    // Ground texture - grass patches
    this.ctx.fillStyle = '#228B22'; // Forest green
    for (let x = this.gameState.groundX; x < GAME_CONFIG.canvas.width + 50; x += 30) {
      const grassHeight = 3 + Math.sin(x * 0.1) * 2;
      this.ctx.fillRect(x, GAME_CONFIG.ground.y - grassHeight, 2, grassHeight);
      this.ctx.fillRect(x + 5, GAME_CONFIG.ground.y - grassHeight + 1, 2, grassHeight - 1);
      this.ctx.fillRect(x + 10, GAME_CONFIG.ground.y - grassHeight - 1, 2, grassHeight + 1);
    }

    // Small rocks
    this.ctx.fillStyle = '#696969'; // Dim gray
    for (let x = this.gameState.groundX; x < GAME_CONFIG.canvas.width; x += 45) {
      if (Math.sin(x * 0.05) > 0.3) {
        this.ctx.beginPath();
        this.ctx.arc(x, GAME_CONFIG.ground.y + 8, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private renderDino() {
    const dinoHeight = this.dinoState.state === 'DUCKING' ? GAME_CONFIG.dino.duckHeight : GAME_CONFIG.dino.height;
    const x = this.dinoState.x;
    const y = this.dinoState.y;
    const time = Date.now() * 0.01;

    // Dino color scheme
    const primaryColor = this.dinoState.state === 'DEAD' ? '#8B4513' : '#32CD32'; // Brown when dead, green when alive
    const secondaryColor = this.dinoState.state === 'DEAD' ? '#654321' : '#228B22';
    const bellyColor = this.dinoState.state === 'DEAD' ? '#D2691E' : '#90EE90';

    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + 20, y + dinoHeight + 2, 18, 4, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Main body (rounded rectangle)
    this.ctx.fillStyle = primaryColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x + 8, y + 8, 22, dinoHeight - 12, 4);
    this.ctx.fill();

    // Belly
    this.ctx.fillStyle = bellyColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x + 12, y + 12, 14, dinoHeight - 16, 3);
    this.ctx.fill();

    // Head (more rounded)
    this.ctx.fillStyle = primaryColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x + 22, y, 14, 16, 7);
    this.ctx.fill();

    // Snout
    this.ctx.fillStyle = secondaryColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x + 34, y + 6, 6, 6, 3);
    this.ctx.fill();

    // Tail (curved)
    this.ctx.fillStyle = primaryColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + 14, 12, 10, 5);
    this.ctx.fill();

    // Tail tip
    this.ctx.fillStyle = secondaryColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x - 2, y + 16, 6, 6, 3);
    this.ctx.fill();

    // Legs with animation
    this.ctx.fillStyle = primaryColor;
    if (this.dinoState.state === 'RUNNING') {
      const legBob = Math.sin(time * 3) * 2;
      const legBob2 = Math.sin(time * 3 + Math.PI) * 2;
      
      // Front leg
      this.ctx.beginPath();
      this.ctx.roundRect(x + 18, y + dinoHeight - 10 + legBob, 5, 10, 2);
      this.ctx.fill();
      
      // Back leg
      this.ctx.beginPath();
      this.ctx.roundRect(x + 12, y + dinoHeight - 10 + legBob2, 5, 10, 2);
      this.ctx.fill();
      
      // Feet
      this.ctx.fillStyle = secondaryColor;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 17, y + dinoHeight - 2 + legBob, 7, 3, 1);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + 11, y + dinoHeight - 2 + legBob2, 7, 3, 1);
      this.ctx.fill();
      
    } else if (this.dinoState.state === 'DUCKING') {
      // Ducking legs (stretched)
      this.ctx.beginPath();
      this.ctx.roundRect(x + 8, y + dinoHeight - 6, 8, 6, 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + 20, y + dinoHeight - 6, 8, 6, 2);
      this.ctx.fill();
      
      // Feet
      this.ctx.fillStyle = secondaryColor;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 6, y + dinoHeight - 2, 12, 3, 1);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + 18, y + dinoHeight - 2, 12, 3, 1);
      this.ctx.fill();
      
    } else {
      // Static legs
      this.ctx.beginPath();
      this.ctx.roundRect(x + 14, y + dinoHeight - 10, 5, 10, 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + 21, y + dinoHeight - 10, 5, 10, 2);
      this.ctx.fill();
      
      // Feet
      this.ctx.fillStyle = secondaryColor;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 13, y + dinoHeight - 2, 7, 3, 1);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(x + 20, y + dinoHeight - 2, 7, 3, 1);
      this.ctx.fill();
    }

    // Arms
    this.ctx.fillStyle = primaryColor;
    if (this.dinoState.state === 'RUNNING') {
      const armBob = Math.sin(time * 2) * 1;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 8, y + 12 + armBob, 4, 8, 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.roundRect(x + 8, y + 14, 4, 6, 2);
      this.ctx.fill();
    }

    // Eye socket
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(x + 28, y + 6, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Eye
    if (this.dinoState.state === 'DEAD') {
      // X eyes when dead
      this.ctx.strokeStyle = '#FF0000';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 25, y + 4);
      this.ctx.lineTo(x + 31, y + 10);
      this.ctx.moveTo(x + 31, y + 4);
      this.ctx.lineTo(x + 25, y + 10);
      this.ctx.stroke();
    } else {
      // Normal eye
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(x + 28, y + 6, 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(x + 29, y + 6, 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Eye shine
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(x + 30, y + 5, 1, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Nostril
    if (this.dinoState.state !== 'DEAD') {
      this.ctx.fillStyle = secondaryColor;
      this.ctx.beginPath();
      this.ctx.arc(x + 37, y + 8, 1, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Dino spots/texture
    if (this.dinoState.state !== 'DEAD') {
      this.ctx.fillStyle = secondaryColor;
      // Back spots
      this.ctx.beginPath();
      this.ctx.arc(x + 15, y + 12, 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(x + 22, y + 16, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(x + 12, y + 20, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Head spot
      this.ctx.beginPath();
      this.ctx.arc(x + 26, y + 12, 1, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Spikes on back (when not ducking)
    if (this.dinoState.state !== 'DUCKING' && this.dinoState.state !== 'DEAD') {
      this.ctx.fillStyle = '#FFD700'; // Gold spikes
      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + 12 + i * 6, y + 8);
        this.ctx.lineTo(x + 14 + i * 6, y + 4);
        this.ctx.lineTo(x + 16 + i * 6, y + 8);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
  }

  private renderObstacles() {
    this.obstacles.forEach(obstacle => {
      const time = Date.now() * 0.005;
      
      switch (obstacle.type) {
        case 'CACTUS_SMALL':
        case 'CACTUS_LARGE':
          const x = obstacle.x;
          const y = obstacle.y;
          const width = obstacle.width;
          const height = obstacle.height;
          
          // Shadow
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          this.ctx.beginPath();
          this.ctx.ellipse(x + width/2, y + height + 2, width/2 + 2, 3, 0, 0, Math.PI * 2);
          this.ctx.fill();

          // Main cactus body with gradient
          const cactusGradient = this.ctx.createLinearGradient(x, y, x + width, y);
          cactusGradient.addColorStop(0, '#2E8B57'); // Sea green
          cactusGradient.addColorStop(0.3, '#32CD32'); // Lime green  
          cactusGradient.addColorStop(0.7, '#228B22'); // Forest green
          cactusGradient.addColorStop(1, '#006400'); // Dark green
          this.ctx.fillStyle = cactusGradient;
          
          // Rounded main body
          this.ctx.beginPath();
          this.ctx.roundRect(x + 3, y, width - 6, height, 4);
          this.ctx.fill();
          
          // Body segments
          this.ctx.fillStyle = '#228B22';
          for (let i = 1; i < height / 8; i++) {
            this.ctx.beginPath();
            this.ctx.roundRect(x + 4, y + i * 8, width - 8, 2, 1);
            this.ctx.fill();
          }

          // Cactus arms for large cactus
          if (obstacle.type === 'CACTUS_LARGE') {
            // Left arm
            this.ctx.fillStyle = cactusGradient;
            this.ctx.beginPath();
            this.ctx.roundRect(x - 6, y + 12, 10, 15, 3);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.roundRect(x - 8, y + 8, 6, 12, 2);
            this.ctx.fill();
            
            // Right arm
            this.ctx.beginPath();
            this.ctx.roundRect(x + width - 4, y + 20, 10, 12, 3);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.roundRect(x + width + 2, y + 16, 6, 10, 2);
            this.ctx.fill();
          }
          
          // Detailed spikes
          this.ctx.fillStyle = '#8B4513'; // Saddle brown
          for (let i = 0; i < height; i += 4) {
            // Left spikes
            this.ctx.beginPath();
            this.ctx.moveTo(x + 1, y + i);
            this.ctx.lineTo(x - 2, y + i + 1);
            this.ctx.lineTo(x + 1, y + i + 3);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Right spikes
            this.ctx.beginPath();
            this.ctx.moveTo(x + width - 1, y + i + 2);
            this.ctx.lineTo(x + width + 2, y + i + 3);
            this.ctx.lineTo(x + width - 1, y + i + 5);
            this.ctx.closePath();
            this.ctx.fill();
          }
          
          // Cactus flowers
          if (obstacle.type === 'CACTUS_LARGE') {
            // Main flower
            this.ctx.fillStyle = '#FF1493'; // Deep pink
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              this.ctx.beginPath();
              this.ctx.ellipse(
                x + width/2 + Math.cos(angle) * 3,
                y - 5 + Math.sin(angle) * 3,
                3, 1.5, angle, 0, Math.PI * 2
              );
              this.ctx.fill();
            }
            
            // Flower center
            this.ctx.fillStyle = '#FFD700'; // Gold
            this.ctx.beginPath();
            this.ctx.arc(x + width/2, y - 5, 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Small flower on arm
            this.ctx.fillStyle = '#FF69B4'; // Hot pink
            this.ctx.beginPath();
            this.ctx.arc(x - 6, y + 8, 2, 0, Math.PI * 2);
            this.ctx.fill();
          } else {
            // Small cactus bud
            this.ctx.fillStyle = '#90EE90'; // Light green
            this.ctx.beginPath();
            this.ctx.arc(x + width/2, y - 2, 2, 0, Math.PI * 2);
            this.ctx.fill();
          }
          break;
          
        case 'BIRD_HIGH':
        case 'BIRD_LOW':
          const bx = obstacle.x;
          const by = obstacle.y;
          const wingFlap = Math.sin(time * 4) * 0.5 + 0.5; // 0 to 1
          const bodyBob = Math.sin(time * 2) * 2;
          
          // Bird shadow
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          this.ctx.beginPath();
          this.ctx.ellipse(bx + 20, GAME_CONFIG.ground.y, 15, 4, 0, 0, Math.PI * 2);
          this.ctx.fill();

          // Wing shapes (behind body)
          this.ctx.fillStyle = '#4169E1'; // Royal blue
          const wingHeight = 8 + wingFlap * 12;
          const wingAngle = wingFlap * 0.5;
          
          // Back wing
          this.ctx.save();
          this.ctx.translate(bx + 12, by + 10 + bodyBob);
          this.ctx.rotate(-wingAngle);
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, 12, wingHeight, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
          
          // Wing feather details
          this.ctx.fillStyle = '#0000CD';
          this.ctx.save();
          this.ctx.translate(bx + 12, by + 10 + bodyBob);
          this.ctx.rotate(-wingAngle);
          for (let i = 0; i < 3; i++) {
            this.ctx.fillRect(-8 + i * 4, -wingHeight/2, 2, wingHeight);
          }
          this.ctx.restore();

          // Main body (oval)
          this.ctx.fillStyle = '#4169E1'; // Royal blue
          this.ctx.beginPath();
          this.ctx.ellipse(bx + 20, by + 12 + bodyBob, 12, 8, 0, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Belly
          this.ctx.fillStyle = '#87CEEB'; // Sky blue
          this.ctx.beginPath();
          this.ctx.ellipse(bx + 20, by + 14 + bodyBob, 8, 5, 0, 0, Math.PI * 2);
          this.ctx.fill();

          // Head (rounded)
          this.ctx.fillStyle = '#1E90FF'; // Dodger blue
          this.ctx.beginPath();
          this.ctx.arc(bx + 30, by + 10 + bodyBob, 6, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Beak
          this.ctx.fillStyle = '#FFA500'; // Orange
          this.ctx.beginPath();
          this.ctx.moveTo(bx + 36, by + 9 + bodyBob);
          this.ctx.lineTo(bx + 42, by + 11 + bodyBob);
          this.ctx.lineTo(bx + 36, by + 13 + bodyBob);
          this.ctx.closePath();
          this.ctx.fill();
          
          // Beak detail
          this.ctx.fillStyle = '#FF8C00'; // Dark orange
          this.ctx.beginPath();
          this.ctx.moveTo(bx + 36, by + 10 + bodyBob);
          this.ctx.lineTo(bx + 39, by + 11 + bodyBob);
          this.ctx.lineTo(bx + 36, by + 12 + bodyBob);
          this.ctx.closePath();
          this.ctx.fill();

          // Front wing (over body)
          this.ctx.fillStyle = '#0000CD'; // Medium blue
          this.ctx.save();
          this.ctx.translate(bx + 15, by + 8 + bodyBob);
          this.ctx.rotate(wingAngle);
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, 10, wingHeight - 2, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
          
          // Front wing details
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.save();
          this.ctx.translate(bx + 15, by + 8 + bodyBob);
          this.ctx.rotate(wingAngle);
          for (let i = 0; i < 2; i++) {
            this.ctx.fillRect(-6 + i * 4, -(wingHeight-2)/2, 1, wingHeight-2);
          }
          this.ctx.restore();

          // Tail feathers
          this.ctx.fillStyle = '#4169E1';
          this.ctx.beginPath();
          this.ctx.moveTo(bx + 8, by + 10 + bodyBob);
          this.ctx.lineTo(bx + 2, by + 8 + bodyBob);
          this.ctx.lineTo(bx + 6, by + 12 + bodyBob);
          this.ctx.lineTo(bx + 2, by + 16 + bodyBob);
          this.ctx.lineTo(bx + 8, by + 14 + bodyBob);
          this.ctx.closePath();
          this.ctx.fill();

          // Eye
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.beginPath();
          this.ctx.arc(bx + 32, by + 8 + bodyBob, 2, 0, Math.PI * 2);
          this.ctx.fill();
          
          this.ctx.fillStyle = '#000000';
          this.ctx.beginPath();
          this.ctx.arc(bx + 33, by + 8 + bodyBob, 1, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Eye shine
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.beginPath();
          this.ctx.arc(bx + 33.5, by + 7.5 + bodyBob, 0.5, 0, Math.PI * 2);
          this.ctx.fill();

          // Legs (if flying low)
          if (obstacle.type === 'BIRD_LOW') {
            this.ctx.strokeStyle = '#FFA500';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(bx + 18, by + 18 + bodyBob);
            this.ctx.lineTo(bx + 16, by + 22 + bodyBob);
            this.ctx.moveTo(bx + 22, by + 18 + bodyBob);
            this.ctx.lineTo(bx + 24, by + 22 + bodyBob);
            this.ctx.stroke();
            
            // Feet
            this.ctx.beginPath();
            this.ctx.moveTo(bx + 14, by + 22 + bodyBob);
            this.ctx.lineTo(bx + 18, by + 22 + bodyBob);
            this.ctx.moveTo(bx + 22, by + 22 + bodyBob);
            this.ctx.lineTo(bx + 26, by + 22 + bodyBob);
            this.ctx.stroke();
          }
          break;
      }
    });
  }

  private renderUI() {
    // Score with background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fillRect(GAME_CONFIG.canvas.width - 160, 5, 150, 35);
    
    this.ctx.fillStyle = '#2F4F4F'; // Dark slate gray
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'right';
    
    // Score
    const score = Math.floor(this.gameState.score).toString().padStart(5, '0');
    this.ctx.fillText(`HI ${this.gameState.highScore.toString().padStart(5, '0')}`, 
                     GAME_CONFIG.canvas.width - 20, 22);
    this.ctx.fillStyle = '#FF6347'; // Tomato red
    this.ctx.fillText(`${score}`, GAME_CONFIG.canvas.width - 20, 35);

    // Game state messages
    this.ctx.textAlign = 'center';

    if (this.gameState.state === 'MENU') {
      // Title background
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.fillRect(GAME_CONFIG.canvas.width / 2 - 140, GAME_CONFIG.canvas.height / 2 - 50, 280, 60);
      
      this.ctx.fillStyle = '#FF6347'; // Tomato
      this.ctx.font = 'bold 24px monospace';
      this.ctx.fillText('🦕 DINO ADVENTURE', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 30);
      
      this.ctx.fillStyle = '#32CD32'; // Lime green
      this.ctx.font = 'bold 16px monospace';
      this.ctx.fillText('PRESS SPACE TO START', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 5);
    } else if (this.gameState.state === 'GAME_OVER') {
      // Game over background
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      this.ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
      
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.fillRect(GAME_CONFIG.canvas.width / 2 - 120, GAME_CONFIG.canvas.height / 2 - 60, 240, 80);
      
      this.ctx.fillStyle = '#DC143C'; // Crimson
      this.ctx.font = 'bold 28px monospace';
      this.ctx.fillText('💀 GAME OVER', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 35);
      
      this.ctx.fillStyle = '#4169E1'; // Royal blue
      this.ctx.font = 'bold 16px monospace';
      this.ctx.fillText('PRESS SPACE TO RESTART', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 5);
    }
  }

  private gameLoop = (currentTime: number) => {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.updateDino(deltaTime);
    this.updateObstacles(deltaTime);
    this.updateClouds();
    this.updateGame(deltaTime);

    this.render();

    if (this.isRunning) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    audioManager.initialize();
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  getScore() {
    return Math.floor(this.gameState.score);
  }

  getHighScore() {
    return this.gameState.highScore;
  }
}