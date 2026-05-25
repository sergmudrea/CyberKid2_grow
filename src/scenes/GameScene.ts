import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { LevelData, TileType, Inventory } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { logger } from '../core/Logger';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private originalLevelData: LevelData | null = null;
  private levelId: string = '';
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 48;
  private playerSprite: Phaser.GameObjects.Sprite;
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
  private inventory: Inventory = {
    keys: [],
    corn: 0,
    cores: 0,
    hasDrill: false,
    hasHook: false,
    hasWing: false,
    hasBait: false,
    tools: [],
  };
  private lastDirection: 'up' | 'down' | 'left' | 'right' = 'right';

  constructor() {
    super('GameScene');
  }

  async init(data: { levelId: string }): Promise<void> {
    logger.debug('GameScene', 'init', `Initializing with levelId: ${data.levelId}`);
    this.levelId = data.levelId;
    const loadedLevel = await levelManager.loadLevel(this.levelId);
    
    if (!loadedLevel) {
      logger.error('GameScene', 'init', `Level not found: ${this.levelId}`);
      this.scene.start('MainMenu');
      return;
    }
    
    // Сохраняем оригинальную копию уровня
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));
    
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
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    this.lastDirection = 'right';
    
    logger.info('GameScene', 'init', `Level loaded: ${this.levelId} (${this.level.name}), coin at (${this.coinPos.col},${this.coinPos.row})`);
    this.createScene();
  }

  private resetLevel(): void {
    if (!this.originalLevelData) return;
    // Восстанавливаем исходное состояние уровня
    this.level = JSON.parse(JSON.stringify(this.originalLevelData));
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
    this.isBroken = false;
    this.isVictory = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    this.lastDirection = 'right';
    
    // Очищаем контейнер и перерисовываем
    this.gameContainer.removeAll(true);
    this.drawGrid();
    this.drawPlayer();
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
    
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    logger.debug('GameScene', 'createScene', `Game offset X: ${this.gameOffsetX}, Y: ${this.gameOffsetY}`);
    
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
    
    this.drawGrid();
    this.drawPlayer();

    this.needScroll = this.gameBounds.width > this.cameras.main.width || this.gameBounds.height > this.cameras.main.height;
    
    if (this.needScroll) {
      this.gameContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.gameBounds.width, this.gameBounds.height), Phaser.Geom.Rectangle.Contains);
      this.input.setDraggable(this.gameContainer);
      this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
        this.scrollX = dragX;
        this.scrollY = dragY;
        this.updateContainerPosition();
      });
      
      this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        this.scrollX -= deltaX;
        this.scrollY -= deltaY;
        this.updateContainerPosition();
      });
      
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
        this.resetLevel();
        this.visualizer.clear();
        this.isBroken = false;
        this.isVictory = false;
        this.currentCommandIndex = -1;
        this.failedCommandIndex = -1;
        this.commandPanel.clearHighlight();
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

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    if (this.isVictory) {
      alert('You already won! Start a new game.');
      return;
    }
    // Сбрасываем уровень перед выполнением новой программы
    this.resetLevel();
    this.isRunning = true;
    this.isBroken = false;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.commandPanel.clearHighlight();
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
    
    if (cmd === 'push') {
      this.executePush();
      await this.delay(80);
      this.executeCommands(commands, index + 1);
      return;
    }
    
    let dx = 0, dy = 0;
    if (cmd === 'up') { dy = -1; this.lastDirection = 'up'; }
    if (cmd === 'down') { dy = 1; this.lastDirection = 'down'; }
    if (cmd === 'left') { dx = -1; this.lastDirection = 'left'; }
    if (cmd === 'right') { dx = 1; this.lastDirection = 'right'; }

    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    const collisionCell = { col: targetCol, row: targetRow };
    
    const tile = this.level.map[targetRow]?.[targetCol];
    const isWall = tile === TileType.WALL;
    const isHole = tile === TileType.HOLE;
    const isBrick = tile === TileType.BRICK;
    const isOutOfBounds = targetCol < 0 || targetCol >= this.level.width || targetRow < 0 || targetRow >= this.level.height;

    logger.debug('GameScene', 'executeCommands', `Step ${index + 1}/${commands.length}: ${cmd} from (${this.playerPos.col},${this.playerPos.row}) to (${targetCol},${targetRow})`);

    // Кирпич не даёт пройти
    if (!isWall && !isHole && !isBrick && !isOutOfBounds) {
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer();
      
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        logger.info('GameScene', 'executeCommands', `🏆 VICTORY! Reached coin at (${this.playerPos.col},${this.playerPos.row})`);
        this.isVictory = true;
        this.isRunning = false;
        this.commandPanel.clearHighlight();
        
        const stars = this.calculateStars();
        const steps = this.currentCommandIndex + 1;
        progressManager.completeLevel(this.levelId, stars, steps);
        
        this.showVictoryMessage();
        return;
      }
      
      await this.delay(80);
      this.executeCommands(commands, index + 1);
    } else if (isBrick) {
      // Если перед нами кирпич, его нужно толкнуть, иначе нельзя пройти
      logger.debug('GameScene', 'executeCommands', `Brick at (${targetCol},${targetRow}), use PUSH command to move it`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
    } else {
      logger.warn('GameScene', 'executeCommands', `💥 Collision at step ${index + 1}: ${cmd} to (${targetCol},${targetRow})`);
      this.isBroken = true;
      this.failedCommandIndex = index;
      this.commandPanel.highlightCommand(index, 'error');
      this.showGhostAt(collisionCell);
      this.showBrokenMessage();
      this.isRunning = false;
    }
  }

  private executePush(): void {
    if (!this.level) return;
    let dx = 0, dy = 0;
    if (this.lastDirection === 'up') dy = -1;
    if (this.lastDirection === 'down') dy = 1;
    if (this.lastDirection === 'left') dx = -1;
    if (this.lastDirection === 'right') dx = 1;
    
    const brickCol = this.playerPos.col + dx;
    const brickRow = this.playerPos.row + dy;
    const pushCol = brickCol + dx;
    const pushRow = brickRow + dy;
    
    const isBrick = this.level.map[brickRow]?.[brickCol] === TileType.BRICK;
    const isPushFree = this.level.map[pushRow]?.[pushCol] === TileType.PLATFORM;
    
    if (isBrick && isPushFree) {
      this.level.map[brickRow][brickCol] = TileType.PLATFORM;
      this.level.map[pushRow][pushCol] = TileType.BRICK;
      this.redrawCell(brickCol, brickRow);
      this.redrawCell(pushCol, pushRow);
      logger.info('GameScene', 'executePush', `Pushed brick from (${brickCol},${brickRow}) to (${pushCol},${pushRow})`);
    } else if (isBrick && !isPushFree) {
      logger.debug('GameScene', 'executePush', `Cannot push brick, space behind is not free`);
    }
  }

  private redrawCell(col: number, row: number): void {
    const x = col * this.gridSize;
    const y = row * this.gridSize;
    const tile = this.level.map[row][col];
    let textureKey = 'tile_platform';
    if (tile === TileType.WALL) textureKey = 'tile_wall';
    if (tile === TileType.HOLE) textureKey = 'tile_hole';
    if (tile === TileType.BRICK) textureKey = 'tile_brick';
    if (tile === TileType.GOAL) textureKey = 'tile_coin';
    
    // Ищем и удаляем старый спрайт
    const children = this.gameContainer.getAll();
    for (const child of children) {
      if (child.x === x && child.y === y) {
        child.destroy();
        break;
      }
    }
    
    const newTile = this.add.image(x, y, textureKey);
    newTile.setOrigin(0, 0);
    newTile.setDisplaySize(this.gridSize, this.gridSize);
    this.gameContainer.add(newTile);
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
    
    if (this.playerSprite) {
      this.tweens.add({
        targets: this.playerSprite,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 3,
      });
    }
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
    
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.cameras.main.width;
      const y = Math.random() * 100;
      const color = [0xff0000, 0x00ff00, 0x0000ff, 0xffcc00, 0xff00cc][Math.floor(Math.random() * 5)];
      const particle = this.add.rectangle(x, y, 4, 4, color);
      particle.setScrollFactor(0);
      this.tweens.add({
        targets: particle,
        y: y + 200,
        alpha: 0,
        duration: 1000 + Math.random() * 1000,
        onComplete: () => particle.destroy(),
      });
    }
    
    this.time.delayedCall(500, () => {
      this.commandPanel.destroy();
      this.scene.start('VictoryScreen', { 
        levelId: this.levelId, 
        stars: this.calculateStars(), 
        stepsUsed: this.currentCommandIndex + 1 
      });
    });
  }

  private drawGrid(): void {
    if (!this.level) return;
    const { width, height, map } = this.level;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        let textureKey = 'tile_platform';
        if (map[row][col] === TileType.WALL) textureKey = 'tile_wall';
        if (map[row][col] === TileType.HOLE) textureKey = 'tile_hole';
        if (map[row][col] === TileType.BRICK) textureKey = 'tile_brick';
        if (map[row][col] === TileType.GOAL) textureKey = 'tile_coin';
        
        const tile = this.add.image(x, y, textureKey);
        tile.setOrigin(0, 0);
        tile.setDisplaySize(this.gridSize, this.gridSize);
        this.gameContainer.add(tile);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    if (!this.level) return;
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    const texture = 'player_right';
    
    this.playerSprite = this.add.sprite(x, y, texture);
    this.playerSprite.setOrigin(0, 0);
    this.playerSprite.setDisplaySize(this.gridSize, this.gridSize);
    this.gameContainer.add(this.playerSprite);
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      this.isVictory = true;
      const stars = this.calculateStars();
      const steps = this.currentCommandIndex + 1;
      progressManager.completeLevel(this.levelId, stars, steps);
      this.showVictoryMessage();
    }
  }
}
