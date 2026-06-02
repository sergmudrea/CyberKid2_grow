// src/scenes/GameScene.ts
// ============================================================================
// ОСНОВНАЯ ИГРОВАЯ СЦЕНА – ИСПРАВЛЕННАЯ
// ============================================================================
// - При повторном входе в сцену уничтожаются старые панели команд и инвентаря
// - Смерть игрока показывает сообщение DEFEAT, а не "Program stopped"
// - Инвентарь обновляется через события
// ============================================================================

import { Scene } from 'phaser';
import { CommandPanel } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Command } from '../types/index';
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
  private playerSprite: Phaser.GameObjects.Text;
  private commandPanel: CommandPanel | null = null;
  private visualizer: ProgramVisualizer | null = null;
  private inventoryUI: InventoryUI | null = null;
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
    // Уничтожаем старые панели, если они остались от предыдущего раза
    if (this.commandPanel) {
      this.commandPanel.destroy();
      this.commandPanel = null;
    }
    if (this.inventoryUI) {
      this.inventoryUI.destroy();
      this.inventoryUI = null;
    }
    if (this.visualizer) {
      this.visualizer.clear();
      this.visualizer = null;
    }
    this.isExecuting = false;
    if (this.executionEngine) {
      this.executionEngine.stop();
      this.executionEngine = null;
    }
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
      height: this.level.height * this.gridSize,
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

    // Визуализатор
    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    // Панель команд
    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetLevel();
        this.visualizer?.clear();
        this.isExecuting = false;
        this.commandPanel?.clearHighlight();
        this.updateVisualizer();
        this.cameraFollowEnabled = true;
        this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );
    this.commandPanel.setAllowedCommands(this.level?.allowedCommands || []);
    this.updateVisualizer();

    if (this.player) {
      this.inventoryUI = new InventoryUI(this, this.player.getInventory());
    }

    // Кнопка BACK
    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    backButton.on('pointerdown', () => {
      this.inventoryUI?.destroy();
      this.commandPanel?.destroy();
      if (this.executionEngine) this.executionEngine.stop();
      this.scene.start('MainMenu');
    });

    // AutoSolve (заглушка)
    const autoSolveBtn = this.add.text(10, this.cameras.main.height - 40, '🧠 AutoSolve', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#1a1a3a',
      padding: { x: 10, y: 5 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    autoSolveBtn.on('pointerdown', () => {
      this.autoSolve();
    });

    this.setupExecutionListeners();
    logger.info('GameScene', 'create', 'Scene ready');
  }

  private disableCameraFollowTemporarily(): void { /* ... */ }
  private clampCamera(): void { /* ... */ }
  private autoSolve(): void { /* ... */ }

  private setupExecutionListeners(): void {
    eventBus.on('EXECUTION_STEP', (payload: any) => {
      if (payload?.stepIndex !== undefined) {
        this.commandPanel?.highlightCommand(payload.stepIndex, 'running');
      }
    });
    eventBus.on('EXECUTION_ERROR', (payload: any) => {
      if (payload?.stepIndex !== undefined) {
        this.commandPanel?.highlightCommand(payload.stepIndex, 'error');
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
      const pos = this.player?.getPosition();
      const onCoin = pos && this.level && pos.col === this.level.coinPos.col && pos.row === this.level.coinPos.row;
      if (payload?.success && onCoin) {
        const stars = payload.result?.stars || 0;
        const steps = payload.result?.steps || 0;
        progressManager.completeLevel(this.levelId, stars, steps);
        this.showVictoryMessage(stars, steps);
      } else {
        // Программа завершилась, но монетка не достигнута – просто остановка (не поражение)
        logger.info('GameScene', 'EXECUTION_FINISHED', 'Program finished without victory');
        const msg = this.add.text(
          this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
          100,
          '⏹️ Program stopped',
          { fontSize: '20px', color: '#ffaa00', backgroundColor: '#000000aa', padding: { x: 15, y: 8 } }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.time.delayedCall(2000, () => msg.destroy());
      }
    });
    eventBus.on('PLAYER_DIED', (payload: any) => {
      this.isExecuting = false;
      this.showDefeatMessage();
    });
  }

  private updateVisualizer(): void {
    if (!this.level) return;
    if (!this.commandPanel) return;
    const commands = this.commandPanel.getCommands();
    this.visualizer?.updateVisuals(
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
      this.executionEngine = null;
    }
    this.resetLevel();
    this.isExecuting = true;
    this.commandPanel?.clearHighlight();
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
      { fontSize: '28px', color: '#ffcc00', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      this.inventoryUI?.destroy();
      this.commandPanel?.destroy();
      this.scene.start('VictoryScreen', { levelId: this.levelId, stars: stars, stepsUsed: steps });
    });
  }

  private showDefeatMessage(): void {
    const msg = this.add.text(
      this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
      100,
      '💥 DEFEAT! 💥',
      { fontSize: '28px', color: '#ff0000', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => this.resetLevel());
  }

  private drawGrid(): void {
    // ... (без изменений, иконки уже есть)
  }
  private drawPlayer(): void {
    // ... (без изменений)
  }
}
