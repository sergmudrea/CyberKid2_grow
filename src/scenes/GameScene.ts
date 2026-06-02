// src/scenes/GameScene.ts
// ============================================================================
// ОСНОВНАЯ ИГРОВАЯ СЦЕНА – СТАБИЛЬНАЯ ВЕРСИЯ
// ============================================================================
// - Камера не следует за игроком (чтобы избежать ошибок startFollow)
// - Все объекты инициализируются корректно
// - Принудительное обновление инвентаря через события
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
  private playerSprite: Phaser.GameObjects.Text | null = null;
  private commandPanel: CommandPanel | null = null;
  private visualizer: ProgramVisualizer | null = null;
  private inventoryUI: InventoryUI | null = null;
  private executionEngine: ExecutionEngine | null = null;
  private isExecuting: boolean = false;
  private gameContainer: Phaser.GameObjects.Container | null = null;
  private readonly COMMAND_PANEL_WIDTH = 280;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
    logger.debug('GameScene', 'init', `levelId = ${this.levelId}`);

    // Уничтожаем старые панели
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
    if (this.playerSprite) {
      this.playerSprite.destroy();
      this.playerSprite = null;
    }
    this.isExecuting = false;
    if (this.executionEngine) {
      this.executionEngine.stop();
      this.executionEngine = null;
    }
  }

  async create(): Promise<void> {
    logger.info('GameScene', 'create', `Loading level: ${this.levelId}`);

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

    // Контейнер для игровых объектов (сдвинут вправо)
    this.gameContainer = this.add.container(this.COMMAND_PANEL_WIDTH, 0);

    // Отрисовка сетки и игрока
    this.drawGrid();
    this.drawPlayer();

    // Настройка камеры – просто устанавливаем границы, без следования
    const gameWidth = this.level.width * this.gridSize;
    const gameHeight = this.level.height * this.gridSize;
    this.cameras.main.setBounds(0, 0, gameWidth, gameHeight);
    this.cameras.main.centerOn(gameWidth / 2, gameHeight / 2);
    this.cameras.main.setZoom(1);

    // Управление камерой (мышь и клавиши)
    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      this.cameras.main.scrollX += deltaX;
      this.cameras.main.scrollY += deltaY;
      this.clampCamera(gameWidth, gameHeight);
    });

    const scrollStep = 50;
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.cameras.main.scrollX -= scrollStep;
      this.clampCamera(gameWidth, gameHeight);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.cameras.main.scrollX += scrollStep;
      this.clampCamera(gameWidth, gameHeight);
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.cameras.main.scrollY -= scrollStep;
      this.clampCamera(gameWidth, gameHeight);
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.cameras.main.scrollY += scrollStep;
      this.clampCamera(gameWidth, gameHeight);
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

    // AutoSolve
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

  private clampCamera(gameWidth: number, gameHeight: number): void {
    const cam = this.cameras.main;
    const maxX = gameWidth - cam.width;
    const maxY = gameHeight - cam.height;
    cam.scrollX = Math.max(0, Math.min(cam.scrollX, maxX));
    cam.scrollY = Math.max(0, Math.min(cam.scrollY, maxY));
  }

  private autoSolve(): void {
    if (!this.level || !this.player) return;
    logger.warn('GameScene', 'autoSolve', 'Pathfinder not implemented yet');
    const msg = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      '🧪 AutoSolve: coming soon',
      { fontSize: '18px', color: '#ffaa00', backgroundColor: '#000000aa', padding: { x: 15, y: 8 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());
  }

  private setupExecutionListeners(): void {
    eventBus.on('EXECUTION_STEP', (payload: any) => {
      if (payload?.stepIndex !== undefined && this.commandPanel) {
        this.commandPanel.highlightCommand(payload.stepIndex, 'running');
      }
    });
    eventBus.on('EXECUTION_ERROR', (payload: any) => {
      if (payload?.stepIndex !== undefined && this.commandPanel) {
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
      const pos = this.player?.getPosition();
      const onCoin = pos && this.level && pos.col === this.level.coinPos.col && pos.row === this.level.coinPos.row;
      if (payload?.success && onCoin) {
        const stars = payload.result?.stars || 0;
        const steps = payload.result?.steps || 0;
        progressManager.completeLevel(this.levelId, stars, steps);
        this.showVictoryMessage(stars, steps);
      } else {
        logger.info('GameScene', 'EXECUTION_FINISHED', 'Program finished without victory');
        const msg = this.add.text(
          this.cameras.main.centerX,
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
    if (this.gameContainer) {
      this.gameContainer.removeAll(true);
    }
    this.drawGrid();
    this.drawPlayer();
    this.updateVisualizer();
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
      this.cameras.main.centerX,
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
      this.cameras.main.centerX,
      100,
      '💥 DEFEAT! 💥',
      { fontSize: '28px', color: '#ff0000', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => this.resetLevel());
  }

  private drawGrid(): void {
    if (!this.level) return;
    const { width, height, map } = this.level;
    const monsters = this.level.objects?.monsters || [];
    const items = this.level.items || [];

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        const tile = map[row][col];
        let icon = '';
        let bgColor = '#2d2d3a';

        switch (tile) {
          case TileType.PLATFORM:   icon = '⬜'; bgColor = '#8B5A2B'; break;
          case TileType.WALL:       icon = '🧱'; bgColor = '#555555'; break;
          case TileType.HOLE:       icon = '🕳️'; bgColor = '#000000'; break;
          case TileType.GOAL:       icon = '💰'; bgColor = '#ffcc00'; break;
          case TileType.KEY:        icon = '🔑'; bgColor = '#ffaa00'; break;
          case TileType.DOOR_LOCKED: icon = '🔒'; bgColor = '#8B0000'; break;
          case TileType.DOOR_UNLOCKED: icon = '🔓'; bgColor = '#228B22'; break;
          case TileType.CONVEYOR_UP: icon = '⬆️'; bgColor = '#666666'; break;
          case TileType.CONVEYOR_DOWN: icon = '⬇️'; bgColor = '#666666'; break;
          case TileType.CONVEYOR_LEFT: icon = '⬅️'; bgColor = '#666666'; break;
          case TileType.CONVEYOR_RIGHT: icon = '➡️'; bgColor = '#666666'; break;
          case TileType.SPRING:     icon = '⬆️⬆️'; bgColor = '#ff6600'; break;
          case TileType.TELEPORT_IN: icon = '🌀'; bgColor = '#9932CC'; break;
          case TileType.TELEPORT_OUT: icon = '🌀'; bgColor = '#9932CC'; break;
          case TileType.LAVA:        icon = '🌋'; bgColor = '#ff4500'; break;
          case TileType.WATER:       icon = '💧'; bgColor = '#1E90FF'; break;
          case TileType.GLUE:        icon = '🩹'; bgColor = '#88cc88'; break;
          case TileType.CAGE:        icon = '🔐'; bgColor = '#cd7f32'; break;
          case TileType.TRAP:        icon = '⚠️'; bgColor = '#8b4513'; break;
          case TileType.GEM:         icon = '💎'; bgColor = '#00ffcc'; break;
          case TileType.BRICK:       icon = '🧱'; bgColor = '#A52A2A'; break;
          case TileType.BLACK_BOX:   icon = '📦'; bgColor = '#2F4F4F'; break;
          case TileType.BUTTON:      icon = '🔘'; bgColor = '#DC143C'; break;
          case TileType.LEVER:       icon = '🎚️'; bgColor = '#D2691E'; break;
          case TileType.TIMER:       icon = '⏲️'; bgColor = '#FFD700'; break;
          case TileType.SENSOR:      icon = '📡'; bgColor = '#00CED1'; break;
          case TileType.SORTER:      icon = '📊'; bgColor = '#4B0082'; break;
          default: icon = '⬜'; bgColor = '#8B5A2B'; break;
        }

        const monsterHere = monsters.find((m: any) => m.position.col === col && m.position.row === row);
        if (monsterHere) {
          if (monsterHere.type === 'patrol') icon = '👾';
          else if (monsterHere.type === 'chase') icon = '👾⚡';
          else if (monsterHere.type === 'tameable') icon = '👾❤️';
          else if (monsterHere.type === 'phased') icon = '👾🌫️';
          else if (monsterHere.type === 'zombie') icon = '🧟';
          else if (monsterHere.type === 'boss') icon = '👾👑';
          else icon = '👾';
          bgColor = '#4a1a4a';
        }

        const itemHere = items.find((it: any) => it.pos.col === col && it.pos.row === row);
        if (itemHere) {
          if (itemHere.id === 'key1') icon = '🔑';
          else if (itemHere.id === 'corn1') icon = '🌽';
          else if (itemHere.id === 'core1') icon = '💎';
          else if (itemHere.id === 'drill') icon = '🔧';
          else if (itemHere.id === 'hook') icon = '🪝';
          else if (itemHere.id === 'wing') icon = '🪽';
          else if (itemHere.id === 'bait') icon = '🐟';
          else if (itemHere.id === 'cage_key') icon = '🔑';
          else if (itemHere.id === 'gem1') icon = '💎';
          bgColor = '#2a5a2a';
        }

        const bgRect = this.add.rectangle(x, y, this.gridSize, this.gridSize, Phaser.Display.Color.HexStringToColor(bgColor).color, 0.8);
        bgRect.setOrigin(0, 0);
        bgRect.setStrokeStyle(1, 0xaaaaaa);
        this.gameContainer?.add(bgRect);

        const iconText = this.add.text(x + this.gridSize / 2, y + this.gridSize / 2, icon, {
          fontSize: `${Math.floor(this.gridSize * 0.6)}px`,
          fontFamily: 'Arial',
          color: '#ffffff',
          align: 'center',
        }).setOrigin(0.5);
        this.gameContainer?.add(iconText);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
      this.playerSprite = null;
    }
    if (!this.level || !this.player) return;
    const pos = this.player.getPosition();
    const x = pos.col * this.gridSize + this.gridSize / 2;
    const y = pos.row * this.gridSize + this.gridSize / 2;
    this.playerSprite = this.add.text(x, y, '🤖', {
      fontSize: `${Math.floor(this.gridSize * 0.7)}px`,
      fontFamily: 'Arial',
      color: '#00ffcc',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    this.gameContainer?.add(this.playerSprite);
  }
}
