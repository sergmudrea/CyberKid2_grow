import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { LevelData, TileType } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { logger } from '../core/Logger';

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
  private gameContainer: Phaser.GameObjects.Container;
  private gameBounds: { width: number; height: number };
  private gameOffsetX: number = 0;
  private gameOffsetY: number = 0;
  private lastInputTime: number = 0;
  private isPlayerControlled: boolean = false;
  private currentCommandIndex: number = -1;
  private failedCommandIndex: number = -1;
  private needScroll: boolean = false;
  private scrollX: number = 0;
  private scrollY: number = 0;

  constructor() {
    super('GameScene');
  }

  async init(data: { levelId: string }): Promise<void> {
    logger.debug('GameScene', 'init', `Initializing with levelId: ${data.levelId}`);
    this.levelId = data.levelId;
    this.level = await levelManager.loadLevel(this.levelId);
    
    if (!this.level) {
      logger.error('GameScene', 'init', `Level not found: ${this.levelId}`);
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
    this.scrollX = 0;
    this.scrollY = 0;
    
    logger.info('GameScene', 'init', `Level loaded: ${this.levelId} (${this.level.name})`);
    this.createScene();
  }

  private createScene(): void {
    if (!this.level) {
      logger.error('GameScene', 'createScene', 'No level data');
      return;
    }
    
    this.gameContainer = this.add.container(0, 0);
    
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    
    // Центрируем контейнер
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    logger.debug('GameScene', 'createScene', `Game offset X: ${this.gameOffsetX}, Y: ${this.gameOffsetY}`);
    
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
    
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();

    // Проверяем, нужен ли скролл
    this.needScroll = this.gameBounds.width > this.cameras.main.width || this.gameBounds.height > this.cameras.main.height;
    
    if (this.needScroll) {
      // Включаем перетаскивание мышью
      this.gameContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.gameBounds.width, this.gameBounds.height), Phaser.Geom.Rectangle.Contains);
      this.input.setDraggable(this.gameContainer);
      this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
        this.scrollX = dragX;
        this.scrollY = dragY;
        this.updateContainerPosition();
      });
      
      // Скролл колёсиком мыши
      this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        this.scrollX -= deltaX;
        this.scrollY -= deltaY;
        this.updateContainerPosition();
      });
      
      // Управление стрелками клавиатуры
      this.input.keyboard?.on('keydown-LEFT', () => {
        this.scrollX += 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-RIGHT', () => {
        this.scrollX -= 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-UP', () => {
        this.scrollY += 30;
        this.updateContainerPosition();
      });
      this.input.keyboard?.on('keydown-DOWN', () => {
        this.scrollY -= 30;
        this.updateContainerPosition();
      });
    }

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
        this.resetScroll();
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
  }
  
  private updateContainerPosition(): void {
    const minX = this.cameras.main.width - this.gameBounds.width;
    const minY = this.cameras.main.height - this.gameBounds.height;
    const maxX = this.gameOffsetX;
    const maxY = this.gameOffsetY;
    
    let newX = this.gameOffsetX + this.scrollX;
    let newY = this.gameOffsetY + this.scrollY;
    
    newX = Math.max(Math.min(newX, maxX), minX);
    newY = Math.max(Math.min(newY, maxY), minY);
    
    this.gameContainer.setPosition(newX, newY);
  }
  
  private resetScroll(): void {
    this.scrollX = 0;
    this.scrollY = 0;
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
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
      if (!this.isVictory && !this.isBroken) {
        this.checkVictory();
      }
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

    logger.debug('GameScene', 'executeCommands', `Step ${index + 1}/${commands.length}: ${cmd} from (${this.playerPos.col},${this.playerPos.row}) to (${targetCol},${targetRow}) | Wall:${isWall} Hole:${isHole} OutOfBounds:${isOutOfBounds}`);

    if (!isWall && !isHole && !isOutOfBounds) {
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer();
      
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        logger.info('GameScene', 'executeCommands', `Victory! Reached coin at (${this.playerPos.col},${this.playerPos.row})`);
        this.isVictory = true;
        this.isRunning = false;
        this.commandPanel.clearHighlight();
        this.showVictoryMessage();
        return;
      }
      
      await this.delay(80);
      this.executeCommands(commands, index + 1);
    } else {
      logger.warn('GameScene', 'executeCommands', `Collision at step ${index + 1}: ${cmd} to (${targetCol},${targetRow})`);
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

  private calculateStars(): number {
    if (!this.level) return 1;
    const optimalSteps = this.level.optimalSteps || 18;
    const stepsUsed = this.currentCommandIndex + 1;
    
    if (stepsUsed <= optimalSteps) return 3;
    if (stepsUsed <= optimalSteps * 1.5) return 2;
    return 1;
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
    
    // Сохраняем прогресс
    if (this.level && !this.isVictory) {
      const stars = this.calculateStars();
      const steps = this.currentCommandIndex + 1;
      logger.info('GameScene', 'showVictoryMessage', `Saving progress for ${this.levelId}: ${stars} stars, ${steps} steps`);
      progressManager.completeLevel(this.levelId, stars, steps);
    }
    
    this.time.delayedCall(500, () => {
      alert('Victory!');
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
  }

  private drawGrid(): void {
    if (!this.level) return;
    const { width, height, map } = this.level;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        let color = 0x8B5A2B;
        if (map[row][col] === TileType.WALL) color = 0x555555;
        if (map[row][col] === TileType.HOLE) color = 0x000000;
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
