import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { LevelData, TileType } from '../types/index';
import { levelManager } from '../managers/LevelManager';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private levelId: string = '';
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 40;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private coinSprite: Phaser.GameObjects.Rectangle;
  private commandPanel: CommandPanel;
  private visualizer: ProgramVisualizer;
  private isRunning: boolean = false;
  private isBroken: boolean = false;
  private isVictory: boolean = false;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private gameContainer: Phaser.GameObjects.Container;
  private gameBounds: { width: number; height: number };
  private gameOffsetX: number = 0;
  private gameOffsetY: number = 0;
  private lastInputTime: number = 0;
  private isPlayerControlled: boolean = false;
  private currentCommandIndex: number = -1;
  private failedCommandIndex: number = -1;

  constructor() {
    super('GameScene');
  }

  async init(data: { levelId: string }): Promise<void> {
    console.log('GameScene init', data);
    this.levelId = data.levelId;
    this.level = await levelManager.loadLevel(this.levelId);
    console.log('Level loaded:', this.level);
    if (!this.level) {
      console.error('Level not found');
      this.scene.start('MainMenu');
      return;
    }
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
    this.isRunning = false;
    this.isBroken = false;
    this.isVictory = false;
    this.lastInputTime = 0;
    this.isPlayerControlled = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    
    // Создаём сцену только после загрузки уровня
    this.createScene();
  }

  private createScene(): void {
    console.log('GameScene create');
    if (!this.level) {
      console.error('No level in create');
      return;
    }
    
    console.log('Level width:', this.level.width, 'height:', this.level.height);
    
    this.gameContainer = this.add.container(0, 0);
    
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    console.log('Offset X:', this.gameOffsetX, 'Offset Y:', this.gameOffsetY);
    
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
    
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();

    this.camera = this.cameras.main;
    this.camera.setBounds(this.gameOffsetX, this.gameOffsetY, this.gameBounds.width, this.gameBounds.height);
    this.camera.setZoom(1);
    this.centerCameraOnPlayer();

    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      this.isPlayerControlled = true;
      this.lastInputTime = Date.now();
      this.camera.scrollX += deltaX;
      this.camera.scrollY += deltaY;
      this.camera.clampBounds();
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      this.isPlayerControlled = true;
      this.lastInputTime = Date.now();
      this.camera.scrollX -= 30;
      this.camera.clampBounds();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.isPlayerControlled = true;
      this.lastInputTime = Date.now();
      this.camera.scrollX += 30;
      this.camera.clampBounds();
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.isPlayerControlled = true;
      this.lastInputTime = Date.now();
      this.camera.scrollY -= 30;
      this.camera.clampBounds();
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.isPlayerControlled = true;
      this.lastInputTime = Date.now();
      this.camera.scrollY += 30;
      this.camera.clampBounds();
    });

    this.time.addEvent({
      delay: 100,
      callback: () => {
        if (this.isPlayerControlled && Date.now() - this.lastInputTime > 5000) {
          this.isPlayerControlled = false;
          this.centerCameraOnPlayer();
        }
      },
      loop: true
    });

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetRobot();
        this.visualizer.clear();
        this.isBroken = false;
        this.isVictory = false;
        this.currentCommandIndex = -1;
        this.failedCommandIndex = -1;
        this.commandPanel.clearHighlight();
        this.drawPlayer();
        this.updateVisualizer();
        this.centerCameraOnPlayer();
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );

    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer();

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
    
    console.log('GameScene create finished');
  }

  private centerCameraOnPlayer(): void {
    if (!this.playerSprite) return;
    const targetX = this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2 - this.camera.width/2;
    const targetY = this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2 - this.camera.height/2;
    this.camera.setScroll(
      Math.max(this.gameOffsetX, Math.min(targetX, this.gameBounds.width - this.camera.width + this.gameOffsetX)),
      Math.max(this.gameOffsetY, Math.min(targetY, this.gameBounds.height - this.camera.height + this.gameOffsetY))
    );
  }

  private updateVisualizer(): void {
    if (!this.level) return;
    const commands = this.commandPanel.getCommands();
    this.visualizer.updateVisuals(
      commands,
      this.level.startPos.col,
      this.level.startPos.row,
      this.level.width,
      this.level.height,
      this.gridSize,
      this.gameOffsetX,
      this.gameOffsetY
    );
  }

  private resetRobot(): void {
    if (!this.level) return;
    this.playerPos = { ...this.level.startPos };
    this.isBroken = false;
    this.isVictory = false;
  }

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    if (this.isVictory) {
      alert('You already won! Start a new game.');
      return;
    }
    this.isRunning = true;
    this.isBroken = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.commandPanel.clearHighlight();
    if (!this.level) return;
    this.playerPos = { ...this.level.startPos };
    this.drawPlayer();
    this.centerCameraOnPlayer();
    this.executeCommands(commands, 0);
  }

  private async executeCommands(commands: Command[], index: number): Promise<void> {
    if (!this.level) return;
    
    if (this.isVictory) {
      this.isRunning = false;
      return;
    }
    if (this.isBroken) {
      this.isRunning = false;
      this.commandPanel.highlightCommand(this.failedCommandIndex, 'error');
      this.showBrokenMessage();
      return;
    }
    if (index >= commands.length) {
      this.isRunning = false;
      this.commandPanel.clearHighlight();
      if (!this.isVictory && !this.isBroken) this.checkVictory();
      return;
    }

    this.currentCommandIndex = index;
    this.commandPanel.highlightCommand(index, 'running');

    const cmd = commands[index];
    let dx = 0, dy = 0;
    if (cmd === 'up') dy = -1;
    if (cmd === 'down') dy = 1;
    if (cmd === 'left') dx = -1;
    if (cmd === 'right') dx = 1;

    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    const collisionCell = { col: targetCol, row: targetRow };
    
    const tile = this.level.map[targetRow]?.[targetCol];
    const isWall = tile === TileType.WALL;
    const isHole = tile === TileType.HOLE;
    const isOutOfBounds = targetCol < 0 || targetCol >= this.level.width || targetRow < 0 || targetRow >= this.level.height;

    if (!isWall && !isHole && !isOutOfBounds) {
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer();
      
      if (!this.isPlayerControlled) {
        this.centerCameraOnPlayer();
      } else {
        const playerScreenX = this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2 - this.camera.scrollX;
        const playerScreenY = this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2 - this.camera.scrollY;
        if (playerScreenX < 50 || playerScreenX > this.camera.width - 50 ||
            playerScreenY < 50 || playerScreenY > this.camera.height - 50) {
          this.centerCameraOnPlayer();
        }
      }
      
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        this.isVictory = true;
        this.isRunning = false;
        this.commandPanel.clearHighlight();
        this.showVictoryMessage();
        return;
      }
      
      await this.delay(80);
      this.executeCommands(commands, index + 1);
    } else {
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.showGhostAt(collisionCell);
      const collisionX = this.gameOffsetX + collisionCell.col * this.gridSize;
      const collisionY = this.gameOffsetY + collisionCell.row * this.gridSize;
      const flash = this.add.rectangle(collisionX, collisionY, this.gridSize, this.gridSize, 0xff0000, 0.8).setOrigin(0, 0);
      this.time.delayedCall(300, () => flash.destroy());
      this.playerSprite.setFillStyle(0xff0000);
      this.commandPanel.highlightCommand(index, 'error');
      this.showBrokenMessage();
      this.isRunning = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  private showGhostAt(cell: { col: number; row: number }): void {
    const x = this.gameOffsetX + cell.col * this.gridSize;
    const y = this.gameOffsetY + cell.row * this.gridSize;
    const ghost = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00, 0.3).setOrigin(0, 0);
    this.time.delayedCall(500, () => ghost.destroy());
  }

  private showBrokenMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '💥 ROBOT BROKEN! 💥', {
      fontSize: '24px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
  }

  private showVictoryMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '🏆 VICTORY! 🏆', {
      fontSize: '28px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      alert('Victory!');
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
  }

  private drawGrid(): void {
    if (!this.level) return;
    const { width, height, map } = this.level;
    console.log('Drawing grid', width, height);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        let color = 0x8B5A2B;
        if (map[row][col] === TileType.WALL) color = 0x555555;
        if (map[row][col] === TileType.HOLE) color = 0x000000;
        if (map[row][col] === TileType.GOAL) color = 0xffcc00;
        const cell = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0).setStrokeStyle(1, 0xaaaaaa);
        this.gameContainer.add(cell);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    if (!this.level) return;
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    const color = this.isBroken ? 0xff0000 : (this.isVictory ? 0xffcc00 : 0x00ff00);
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
    this.gameContainer.add(this.playerSprite);
  }

  private drawCoin(): void {
    if (this.coinSprite) this.coinSprite.destroy();
    if (!this.level) return;
    const x = this.coinPos.col * this.gridSize;
    const y = this.coinPos.row * this.gridSize;
    this.coinSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00).setOrigin(0, 0);
    this.gameContainer.add(this.coinSprite);
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      this.isVictory = true;
      this.showVictoryMessage();
    }
  }
}
