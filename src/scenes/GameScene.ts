import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Inventory } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { ExecutionEngine } from '../modules/execution';
import { Player } from '../modules/Player';
import { logger } from '../core/Logger';
import { gameEvents as eventBus } from '../core/EventBus';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private originalLevelData: LevelData | null = null;
  private levelId: string = '';
  private player: Player | null = null;
  private gridSize: number = 48;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private commandPanel: CommandPanel;
  private visualizer: ProgramVisualizer;
  private inventoryUI: InventoryUI;
  private executionEngine: ExecutionEngine | null = null;
  private isExecuting: boolean = false;
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
    const loadedLevel = await levelManager.loadLevel(this.levelId);
    
    if (!loadedLevel) {
      logger.error('GameScene', 'init', `Level not found: ${this.levelId}`);
      this.scene.start('MainMenu');
      return;
    }
    
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));
    
    logger.info('GameScene', 'init', `Level loaded: ${this.levelId} (${this.level.name}), coin at (${this.level.coinPos.col},${this.level.coinPos.row})`);
  }

  create(): void {
    logger.info('GameScene', 'create', 'Creating game scene');
    if (!this.level) return;
    
    // Создаём игрока
    const tileGetter = (col: number, row: number): number => {
      if (!this.level) return 0;
      return this.level.map[row]?.[col] ?? 0;
    };
    this.player = new Player(
      this.level.startPos,
      'right',
      this.level.width,
      this.level.height,
      tileGetter
    );
    
    this.gameContainer = this.add.container(0, 0);
    
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    logger.debug('GameScene', 'create', `Game offset X: ${this.gameOffsetX}, Y: ${this.gameOffsetY}`);
    
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
        this.isExecuting = false;
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
    
    if (this.player) {
      this.inventoryUI = new InventoryUI(this, this.player.getInventory());
    }

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.inventoryUI?.destroy();
      this.commandPanel.destroy();
      if (this.executionEngine) this.executionEngine.stop();
      this.scene.start('MainMenu');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
    
    // Подписка на события от ExecutionEngine
    this.setupExecutionListeners();
  }
  
  private setupExecutionListeners(): void {
    eventBus.on('PLAYER_MOVED', (payload: any) => {
      if (payload && payload.to && this.player) {
        this.drawPlayer();
      }
    });
    
    eventBus.on('INVENTORY_CHANGED', (payload: any) => {
      if (payload && payload.inventory && this.inventoryUI && this.player) {
        this.inventoryUI.updateInventory(payload.inventory);
      }
    });
    
    eventBus.on('EXECUTION_STEP', (payload: any) => {
      if (payload && payload.command !== undefined) {
        this.currentCommandIndex = payload.stepIndex;
        this.commandPanel.highlightCommand(this.currentCommandIndex, 'running');
      }
    });
    
    eventBus.on('EXECUTION_FINISHED', (payload: any) => {
      this.isExecuting = false;
      if (payload && payload.success && payload.result) {
        const stars = payload.result.stars;
        const steps = payload.result.steps;
        progressManager.completeLevel(this.levelId, stars, steps);
        this.showVictoryMessage(stars, steps);
      } else {
        this.showDefeatMessage();
      }
    });
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

  private resetLevel(): void {
    if (!this.originalLevelData) return;
    this.level = JSON.parse(JSON.stringify(this.originalLevelData));
    if (this.player) {
      this.player.teleport(this.level.startPos);
      this.player.resetInventory();
      this.player.setTrapped(false);
      this.player.setGlued(false, 0);
    }
    if (this.inventoryUI && this.player) {
      this.inventoryUI.updateInventory(this.player.getInventory());
    }
    if (this.executionEngine) {
      this.executionEngine.reset();
    }
    
    this.gameContainer.removeAll(true);
    this.drawGrid();
    this.drawPlayer();
    this.updateVisualizer();
  }

  private async runProgram(commands: Command[]): Promise<void> {
    if (this.isExecuting) return;
    if (this.executionEngine) {
      this.executionEngine.stop();
    }
    this.resetLevel();
    this.isExecuting = true;
    this.currentCommandIndex = -1;
    this.failedCommandIndex = -1;
    this.commandPanel.clearHighlight();
    
    if (!this.player) return;
    
    this.executionEngine = new ExecutionEngine(this.level, this.player);
    this.executionEngine.loadProgram(commands);
    
    await this.executionEngine.start();
  }

  private showVictoryMessage(stars: number, steps: number): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, `🏆 VICTORY! ★ ${stars} 🏆`, {
      fontSize: '28px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    
    this.time.delayedCall(500, () => {
      this.inventoryUI?.destroy();
      this.commandPanel.destroy();
      this.scene.start('VictoryScreen', { 
        levelId: this.levelId, 
        stars: stars, 
        stepsUsed: steps 
      });
    });
  }

  private showDefeatMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '💥 DEFEAT! 💥', {
      fontSize: '28px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      this.resetLevel();
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
        const tile = map[row][col];
        if (tile === TileType.WALL) color = 0x555555;
        else if (tile === TileType.HOLE) color = 0x000000;
        else if (tile === TileType.BRICK) color = 0xA52A2A;
        else if (tile === TileType.GOAL) color = 0xffcc00;
        else if (tile === TileType.KEY) color = 0xffaa00;
        else if (tile === TileType.DOOR_LOCKED) color = 0x8B0000;
        else if (tile === TileType.DOOR_UNLOCKED) color = 0x228B22;
        else if (tile >= TileType.CONVEYOR_UP && tile <= TileType.CONVEYOR_RIGHT) color = 0x888888;
        else if (tile === TileType.SPRING) color = 0xff6600;
        else if (tile === TileType.TELEPORT_IN || tile === TileType.TELEPORT_OUT) color = 0x9932CC;
        else if (tile === TileType.LAVA) color = 0xff4500;
        else if (tile === TileType.WATER) color = 0x1E90FF;
        else if (tile === TileType.GLUE) color = 0x88cc88;
        else if (tile === TileType.CAGE) color = 0xcd7f32;
        else if (tile === TileType.TRAP) color = 0x8b4513;
        else if (tile === TileType.GEM) color = 0x00ffcc;
        
        const cell = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
        cell.setStrokeStyle(1, 0xaaaaaa);
        this.gameContainer.add(cell);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    if (!this.level || !this.player) return;
    const pos = this.player.getPosition();
    const x = pos.col * this.gridSize;
    const y = pos.row * this.gridSize;
    const color = 0x00ff00;
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
    this.playerSprite.setStrokeStyle(2, 0xffffff);
    this.gameContainer.add(this.playerSprite);
  }
}
