import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Inventory } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { ExecutionEngine } from '../modules/execution';
import { logger } from '../core/Logger';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private originalLevelData: LevelData | null = null;
  private levelId: string = '';
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
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
    
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));
    
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
    this.lastInputTime = 0;
    this.isPlayerControlled = false;
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
    
    this.inventoryUI = new InventoryUI(this, this.inventory);

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.inventoryUI.destroy();
      this.commandPanel.destroy();
      if (this.executionEngine) this.executionEngine.stop();
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

  private resetLevel(): void {
    if (!this.originalLevelData) return;
    this.level = JSON.parse(JSON.stringify(this.originalLevelData));
    this.playerPos = { ...this.level.startPos };
    this.coinPos = { ...this.level.coinPos };
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
    
    if (this.inventoryUI) {
      this.inventoryUI.updateInventory(this.inventory);
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
    
    // Создаём ExecutionEngine с текущим уровнем и игроком
    // Для упрощения используем заглушку Player, но в реальности должен быть передан объект player
    // Создаём временный объект player с нужными методами
    const dummyPlayer = {
      getPosition: () => this.playerPos,
      getDirection: () => this.lastDirection,
      getInventory: () => this.inventory,
      move: (cmd: Command) => {
        // В новой архитектуре движок сам управляет позицией
        logger.debug('GameScene', 'runProgram', `Move command: ${cmd}`);
        return true;
      },
      teleport: (pos: Point) => {
        this.playerPos = pos;
        this.drawPlayer();
      },
      setGlued: (glued: boolean, turns?: number) => {},
      setTrapped: (trapped: boolean) => {},
      isGlued: () => false,
      isTrapped: () => false,
      rideMonster: (monster: any) => {},
    };
    
    this.executionEngine = new ExecutionEngine(this.level, dummyPlayer);
    this.executionEngine.loadProgram(commands);
    
    // Подписываемся на события выполнения
    const onStep = (payload: any) => {
      if (payload && payload.command !== undefined) {
        this.currentCommandIndex = payload.stepIndex;
        this.commandPanel.highlightCommand(this.currentCommandIndex, 'running');
        // Обновляем позицию игрока из движка (нужно получить актуальную позицию)
        // Для этого нужен доступ к player в движке, пока оставим
        this.drawPlayer();
      }
    };
    const onFinished = async (payload: any) => {
      eventBus.off('EXECUTION_STEP', onStep);
      eventBus.off('EXECUTION_FINISHED', onFinished);
      this.isExecuting = false;
      if (payload && payload.success) {
        const result = payload.result;
        if (result && result.success) {
          // Победа
          progressManager.completeLevel(this.levelId, result.stars, result.steps);
          this.showVictoryMessage(result.stars, result.steps);
        } else {
          // Поражение
          this.showDefeatMessage();
        }
      } else {
        this.showDefeatMessage();
      }
    };
    
    eventBus.on('EXECUTION_STEP', onStep);
    eventBus.on('EXECUTION_FINISHED', onFinished);
    
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
      this.inventoryUI.destroy();
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
        if (map[row][col] === TileType.WALL) color = 0x555555;
        if (map[row][col] === TileType.HOLE) color = 0x000000;
        if (map[row][col] === TileType.BRICK) color = 0xA52A2A;
        if (map[row][col] === TileType.GOAL) color = 0xffcc00;
        if (map[row][col] === TileType.KEY) color = 0xffaa00;
        if (map[row][col] === TileType.DOOR_LOCKED) color = 0x8B0000;
        if (map[row][col] === TileType.DOOR_UNLOCKED) color = 0x228B22;
        if (map[row][col] === TileType.CONVEYOR_UP) color = 0x888888;
        if (map[row][col] === TileType.CONVEYOR_DOWN) color = 0x888888;
        if (map[row][col] === TileType.CONVEYOR_LEFT) color = 0x888888;
        if (map[row][col] === TileType.CONVEYOR_RIGHT) color = 0x888888;
        if (map[row][col] === TileType.SPRING) color = 0xff6600;
        if (map[row][col] === TileType.TELEPORT_IN) color = 0x9932CC;
        if (map[row][col] === TileType.TELEPORT_OUT) color = 0x9932CC;
        if (map[row][col] === TileType.LAVA) color = 0xff4500;
        if (map[row][col] === TileType.WATER) color = 0x1E90FF;
        if (map[row][col] === TileType.GLUE) color = 0x88cc88;
        if (map[row][col] === TileType.CAGE) color = 0xcd7f32;
        if (map[row][col] === TileType.TRAP) color = 0x8b4513;
        if (map[row][col] === TileType.GEM) color = 0x00ffcc;
        
        const cell = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
        cell.setStrokeStyle(1, 0xaaaaaa);
        this.gameContainer.add(cell);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    if (!this.level) return;
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    const color = 0x00ff00;
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
    this.playerSprite.setStrokeStyle(2, 0xffffff);
    this.gameContainer.add(this.playerSprite);
  }
}
