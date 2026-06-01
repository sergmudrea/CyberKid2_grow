// src/scenes/GameScene.ts
// ============================================================================
// ОСНОВНАЯ ИГРОВАЯ СЦЕНА
// ============================================================================
// - Загружает уровень, передаёт в CommandPanel список разрешённых команд (allowedCommands)
// - Отрисовывает тайлы, игрока, управляет камерой
// - Интегрирует ExecutionEngine, InventoryUI, ProgramVisualizer
// ============================================================================

import { Scene } from 'phaser';
import { CommandPanel } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Inventory, Command } from '../types/index';
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
  private cameraFollowEnabled: boolean = true;
  private followRestoreTimer?: Phaser.Time.TimerEvent;

  private readonly COMMAND_PANEL_WIDTH = 280;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
    logger.debug('GameScene', 'init', `levelId = ${this.levelId}`);
  }

  async create(): Promise<void> {
    logger.info('GameScene', 'create', 'Loading level...');
    
    const loadedLevel = await levelManager.loadLevel(this.levelId);
    if (!loadedLevel) {
      logger.error('GameScene', 'create', `Level not found: ${this.levelId}`);
      this.scene.start('MainMenu');
      return;
    }
    
    this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
    this.level = JSON.parse(JSON.stringify(loadedLevel));
    
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
    
    this.gameContainer = this.add.container(this.COMMAND_PANEL_WIDTH, 0);
    this.gameBounds = {
      width: this.level.width * this.gridSize,
      height: this.level.height * this.gridSize
    };
    
    this.drawGrid();
    this.drawPlayer();
    
    this.cameras.main.setBounds(0, 0, this.gameBounds.width, this.gameBounds.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    
    // Управление камерой
    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      this.disableCameraFollowTemporarily();
      this.cameras.main.scrollX += deltaX;
      this.cameras.main.scrollY += deltaY;
      this.clampCamera();
    });
    
    const scrollStep = 50;
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.disableCameraFollowTemporarily();
      this.cameras.main.scrollX -= scrollStep;
      this.clampCamera();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.disableCameraFollowTemporarily();
      this.cameras.main.scrollX += scrollStep;
      this.clampCamera();
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.disableCameraFollowTemporarily();
      this.cameras.main.scrollY -= scrollStep;
      this.clampCamera();
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.disableCameraFollowTemporarily();
      this.cameras.main.scrollY += scrollStep;
      this.clampCamera();
    });
    
    // Панель команд – создаём
    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetLevel();
        this.visualizer.clear();
        this.isExecuting = false;
        this.commandPanel.clearHighlight();
        this.updateVisualizer();
        this.cameraFollowEnabled = true;
        this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );
    
    // Устанавливаем разрешённые команды для этого уровня
    if (this.level.allowedCommands) {
      this.commandPanel.setAllowedCommands(this.level.allowedCommands);
      logger.debug('GameScene', 'create', `Allowed commands: ${this.level.allowedCommands.join(', ')}`);
    } else {
      // Если не указано – показываем все команды (обратная совместимость)
      this.commandPanel.setAllowedCommands([]);
    }
    
    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer();
    
    if (this.player) {
      this.inventoryUI = new InventoryUI(this, this.player.getInventory());
    }
    
    // Кнопка BACK
    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 }
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    backButton.on('pointerdown', () => {
      this.inventoryUI?.destroy();
      this.commandPanel.destroy();
      if (this.executionEngine) this.executionEngine.stop();
      this.scene.start('MainMenu');
    });
    
    // AutoSolve (заглушка)
    const autoSolveBtn = this.add.text(10, this.cameras.main.height - 40, '🧠 AutoSolve', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#1a1a3a',
      padding: { x: 10, y: 5 }
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    autoSolveBtn.on('pointerdown', () => {
      this.autoSolve();
    });
    
    this.setupExecutionListeners();
  }
  
  private disableCameraFollowTemporarily(): void {
    if (!this.cameraFollowEnabled) return;
    this.cameraFollowEnabled = false;
    this.cameras.main.stopFollow();
    if (this.followRestoreTimer) this.followRestoreTimer.destroy();
    this.followRestoreTimer = this.time.delayedCall(3000, () => {
      this.cameraFollowEnabled = true;
      this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    });
  }
  
  private clampCamera(): void {
    const cam = this.cameras.main;
    const maxX = this.gameBounds.width - cam.width;
    const maxY = this.gameBounds.height - cam.height;
    cam.scrollX = Math.max(0, Math.min(cam.scrollX, maxX));
    cam.scrollY = Math.max(0, Math.min(cam.scrollY, maxY));
  }
  
  private autoSolve(): void {
    if (!this.level || !this.player) return;
    logger.warn('GameScene', 'autoSolve', 'Pathfinder not implemented yet');
    const msg = this.add.text(
      this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
      this.cameras.main.centerY,
      '🧪 AutoSolve: coming soon',
      {
        fontSize: '18px',
        color: '#ffaa00',
        backgroundColor: '#000000aa',
        padding: { x: 15, y: 8 }
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());
  }
  
  private setupExecutionListeners(): void {
    eventBus.on('EXECUTION_STEP', (payload: any) => {
      if (payload?.stepIndex !== undefined) {
        this.commandPanel.highlightCommand(payload.stepIndex, 'running');
      }
    });
    
    eventBus.on('EXECUTION_ERROR', (payload: any) => {
      if (payload?.stepIndex !== undefined) {
        this.commandPanel.highlightCommand(payload.stepIndex, 'error');
      }
    });
    
    eventBus.on('PLAYER_MOVED', () => {
      this.drawPlayer();
    });
    
    eventBus.on('INVENTORY_CHANGED', (payload: any) => {
      if (payload?.inventory && this.inventoryUI && this.player) {
        this.inventoryUI.updateInventory(payload.inventory);
      }
    });
    
    eventBus.on('EXECUTION_FINISHED', (payload: any) => {
      this.isExecuting = false;
      if (payload?.success && payload.result) {
        const stars = payload.result.stars;
        const steps = payload.result.steps;
        progressManager.completeLevel(this.levelId, stars, steps);
        this.showVictoryMessage(stars, steps);
      } else {
        this.showDefeatMessage();
      }
    });
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
      this.COMMAND_PANEL_WIDTH,
      0
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
    this.cameraFollowEnabled = true;
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
  }
  
  private async runProgram(commands: Command[]): Promise<void> {
    if (this.isExecuting) return;
    if (this.executionEngine) {
      this.executionEngine.stop();
    }
    this.resetLevel();
    this.isExecuting = true;
    this.commandPanel.clearHighlight();
    
    if (!this.player) return;
    
    this.executionEngine = new ExecutionEngine(this.level!, this.player);
    this.executionEngine.loadProgram(commands);
    
    await this.executionEngine.start();
  }
  
  private showVictoryMessage(stars: number, steps: number): void {
    const msg = this.add.text(
      this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
      100,
      `🏆 VICTORY! ★ ${stars} 🏆`,
      {
        fontSize: '28px',
        color: '#ffcc00',
        backgroundColor: '#000000aa',
        padding: { x: 20, y: 10 }
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
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
    const msg = this.add.text(
      this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
      100,
      '💥 DEFEAT! 💥',
      {
        fontSize: '28px',
        color: '#ff0000',
        backgroundColor: '#000000aa',
        padding: { x: 20, y: 10 }
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
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
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    if (!this.level || !this.player) return;
    const pos = this.player.getPosition();
    const x = pos.col * this.gridSize;
    const y = pos.row * this.gridSize;
    const color = 0x00ff00;
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
    this.playerSprite.setStrokeStyle(2, 0xffffff);
    this.gameContainer.add(this.playerSprite);
    
    if (this.cameraFollowEnabled) {
      this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    }
  }
}
