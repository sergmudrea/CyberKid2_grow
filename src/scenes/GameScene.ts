// src/scenes/GameScene.ts (упрощённая версия для проверки отрисовки)
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
  private scrollX: number = 0;
  private scrollY: number = 0;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
  }

  async create(): Promise<void> {
    // Тестовый красный квадрат
    this.add.rectangle(50, 50, 100, 100, 0xff0000);

    const loadedLevel = await levelManager.loadLevel(this.levelId);
    if (!loadedLevel) {
      this.scene.start('MainMenu');
      return;
    }
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));

    console.log('Level loaded, width:', this.level.width, 'height:', this.level.height);
    console.log('First row:', this.level.map[0]);

    // Создаём игрока
    const tileGetter = (col: number, row: number) => this.level!.map[row]?.[col] ?? 0;
    this.player = new Player(
      this.level.startPos,
      'right',
      this.level.width,
      this.level.height,
      tileGetter
    );

    // Контейнер для поля
    this.gameContainer = this.add.container(0, 0);
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);

    // Отрисовка
    this.drawGrid();
    this.drawPlayer();

    // Включаем скролл (перетаскивание)
    this.gameContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.gameBounds.width, this.gameBounds.height), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(this.gameContainer);
    this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
      this.gameContainer.x = this.gameOffsetX + dragX;
      this.gameContainer.y = this.gameOffsetY + dragY;
      // Ограничения (опционально)
      this.gameContainer.x = Math.min(Math.max(this.gameContainer.x, this.cameras.main.width - this.gameBounds.width), this.gameOffsetX);
      this.gameContainer.y = Math.min(Math.max(this.gameContainer.y, this.cameras.main.height - this.gameBounds.height), this.gameOffsetY);
    });
    this.input.on('wheel', (pointer: any, deltaX: number, deltaY: number) => {
      this.gameContainer.x -= deltaX;
      this.gameContainer.y -= deltaY;
      this.gameContainer.x = Math.min(Math.max(this.gameContainer.x, this.cameras.main.width - this.gameBounds.width), this.gameOffsetX);
      this.gameContainer.y = Math.min(Math.max(this.gameContainer.y, this.cameras.main.height - this.gameBounds.height), this.gameOffsetY);
    });

    // Панель команд
    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => this.resetLevel(),
      () => this.updateVisualizer()
    );
    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer();
    this.inventoryUI = new InventoryUI(this, this.player.getInventory());

    // Кнопка BACK
    const backButton = this.add.text(10, 10, '← BACK', { fontSize: '16px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 12, y: 6 } })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.inventoryUI.destroy();
        this.commandPanel.destroy();
        this.scene.start('MainMenu');
      });
    backButton.setScrollFactor(0);

    this.setupExecutionListeners();
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
        else if (tile >= 19 && tile <= 22) color = 0x888888;
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
    if (!this.player) return;
    const pos = this.player.getPosition();
    const x = pos.col * this.gridSize;
    const y = pos.row * this.gridSize;
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00).setOrigin(0, 0);
    this.playerSprite.setStrokeStyle(2, 0xffffff);
    this.gameContainer.add(this.playerSprite);
  }

  private resetLevel(): void {
    if (!this.originalLevelData) return;
    this.level = JSON.parse(JSON.stringify(this.originalLevelData));
    this.player?.teleport(this.level.startPos);
    this.player?.resetInventory();
    if (this.inventoryUI) this.inventoryUI.updateInventory(this.player.getInventory());
    this.gameContainer.removeAll(true);
    this.drawGrid();
    this.drawPlayer();
  }

  private updateVisualizer(): void {
    if (!this.level) return;
    const commands = this.commandPanel.getCommands();
    this.visualizer.updateVisuals(commands, this.level.startPos.col, this.level.startPos.row,
      this.level.width, this.level.height, this.gridSize, this.gameOffsetX, this.gameOffsetY);
  }

  private async runProgram(commands: Command[]): Promise<void> {
    if (this.isExecuting) return;
    this.resetLevel();
    this.isExecuting = true;
    this.executionEngine = new ExecutionEngine(this.level, this.player);
    this.executionEngine.loadProgram(commands);
    await this.executionEngine.start();
  }

  private setupExecutionListeners(): void {
    eventBus.on('EXECUTION_STEP', (payload) => {
      if (payload && payload.command !== undefined) {
        this.commandPanel.highlightCommand(payload.stepIndex, 'running');
      }
    });
    eventBus.on('EXECUTION_FINISHED', (payload) => {
      this.isExecuting = false;
      if (payload?.success && payload.result) {
        progressManager.completeLevel(this.levelId, payload.result.stars, payload.result.steps);
        this.showVictoryMessage(payload.result.stars, payload.result.steps);
      } else {
        this.showDefeatMessage();
      }
    });
  }

  private showVictoryMessage(stars: number, steps: number): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, `🏆 VICTORY! ★ ${stars} 🏆`, { fontSize: '28px', color: '#ffcc00', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      this.inventoryUI?.destroy();
      this.commandPanel.destroy();
      this.scene.start('VictoryScreen', { levelId: this.levelId, stars, stepsUsed: steps });
    });
  }

  private showDefeatMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '💥 DEFEAT! 💥', { fontSize: '28px', color: '#ff0000', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => this.resetLevel());
  }
}
