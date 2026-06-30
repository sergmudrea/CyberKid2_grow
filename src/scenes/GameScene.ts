// src/scenes/GameScene.ts
// ============================================================================
// ОСНОВНАЯ ИГРОВАЯ СЦЕНА – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// - Загрузка уровня, создание игрока (с раздельным управлением башней)
// - Отображение сетки с иконками для всех тайлов (включая магниты и замедляющие поля)
// - Визуализация угла башни (текст)
// - Линия прицела (команда SHOW_AIM)
// - Индикатор замедления (SLOW_FIELD)
// - Полное управление камерой (мышь/клавиши)
// - Интеграция с CommandPanel, InventoryUI, ProgramVisualizer
// - Обработка событий выполнения (победа, поражение, остановка)
// - AutoSolve через Pathfinder
// - HintSystem (подсказки)
// - Sandbox/тест-режим (testLevel)
// ============================================================================

import { Scene } from 'phaser';
import { CommandPanel } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';
import { InventoryUI } from '../modules/InventoryUI';
import { LevelData, TileType, Command, ControlMode, Point } from '../types/index';
import { levelManager } from '../managers/LevelManager';
import { settingsManager } from '../managers/SettingsManager';
import { progressManager } from '../managers/ProgressManager';
import { tileTextureKey, monsterTextureKey, itemTextureKey } from '../managers/AssetManager';
import { ExecutionEngine } from '../modules/execution';
import { Player } from '../modules/Player';
import { Pathfinder } from '../modules/Pathfinder';
import { HintSystem } from '../modules/HintSystem';
import { TutorialOverlay } from '../modules/TutorialOverlay';
import { logger } from '../core/Logger';
import { gameEvents as eventBus } from '../core/EventBus';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private originalLevelData: LevelData | null = null;
  private levelId: string = '';
  private isSandboxMode: boolean = false;
  private player: Player | null = null;
  private gridSize: number = 48;
  private playerSprite: Phaser.GameObjects.Image | null = null;
  private turretSprite: Phaser.GameObjects.Image | null = null;
  private commandPanel: CommandPanel | null = null;
  private visualizer: ProgramVisualizer | null = null;
  private inventoryUI: InventoryUI | null = null;
  private executionEngine: ExecutionEngine | null = null;
  private isExecuting: boolean = false;
  private gameContainer: Phaser.GameObjects.Container | null = null;
  private gameBounds: { width: number; height: number } = { width: 0, height: 0 };
  private cameraFollowEnabled: boolean = true;
  private followRestoreTimer?: Phaser.Time.TimerEvent;
  private readonly COMMAND_PANEL_WIDTH = 280;

  // Дополнительные элементы UI для патча 2.0
  private turretAngleText: Phaser.GameObjects.Text | null = null;
  private aimLine: Phaser.GameObjects.Graphics | null = null;
  private slowIndicator: Phaser.GameObjects.Text | null = null;
  private controlMode: ControlMode = ControlMode.SEPARATE;

  // Pathfinder + HintSystem
  private pathfinder: Pathfinder | null = null;
  private hintSystem: HintSystem | null = null;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId?: string; testLevel?: LevelData }): void {
    // Поддержка sandbox-режима
    if (data.testLevel) {
      this.isSandboxMode = true;
      this.level = data.testLevel;
      this.originalLevelData = JSON.parse(JSON.stringify(data.testLevel));
      this.levelId = 'sandbox_test';
    } else {
      this.isSandboxMode = false;
      this.levelId = data.levelId || '';
      this.level = null;
      this.originalLevelData = null;
    }

    logger.debug('GameScene', 'init', `levelId = ${this.levelId}, sandbox = ${this.isSandboxMode}`);

    // Уничтожаем старые панели и спрайты
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
    if (this.turretAngleText) {
      this.turretAngleText.destroy();
      this.turretAngleText = null;
    }
    if (this.aimLine) {
      this.aimLine.clear();
      this.aimLine.destroy();
      this.aimLine = null;
    }
    if (this.slowIndicator) {
      this.slowIndicator.destroy();
      this.slowIndicator = null;
    }
    if (this.hintSystem) {
      this.hintSystem.destroy();
      this.hintSystem = null;
    }
    this.isExecuting = false;
    if (this.executionEngine) {
      this.executionEngine.stop();
      this.executionEngine = null;
    }
  }

  async create(): Promise<void> {
    logger.info('GameScene', 'create', `Loading level: ${this.levelId}, sandbox=${this.isSandboxMode}`);

    // В sandbox-режиме уровень уже задан через init; в обычном — загружаем
    if (!this.isSandboxMode) {
      const loadedLevel = await levelManager.loadLevel(this.levelId);
      if (!loadedLevel) {
        logger.error('GameScene', 'create', `Level not found: ${this.levelId}`);
        this.scene.start('MainMenu');
        return;
      }
      this.originalLevelData = JSON.parse(JSON.stringify(loadedLevel));
      this.level = JSON.parse(JSON.stringify(loadedLevel));
    }

    const level = this.level!;

    // Определяем режим управления (из уровня или настроек)
    this.controlMode = level.controlMode || ControlMode.SEPARATE;

    // Создаём игрока (с начальным углом башни, направлением корпуса)
    const tileGetter = (col: number, row: number): number => {
      if (!this.level) return 0;
      return this.level.map[row]?.[col] ?? 0;
    };
    const startTurretAngle = level.startTurretAngle !== undefined ? level.startTurretAngle : 0;
    const startHullDir = level.startHullDirection || 'right';

    this.player = new Player(
      level.startPos,
      startHullDir,
      level.width,
      level.height,
      tileGetter,
      this.controlMode,
      startTurretAngle
    );

    // Pathfinder
    this.pathfinder = new Pathfinder(level);

    // Контейнер для игровых объектов (сдвинут вправо)
    this.gameContainer = this.add.container(this.COMMAND_PANEL_WIDTH, 0);
    this.gameBounds = {
      width: level.width * this.gridSize,
      height: level.height * this.gridSize,
    };

    this.drawGrid();
    this.drawPlayer();

    // Настройка камеры (без автоматического следования)
    this.cameras.main.setBounds(0, 0, this.gameBounds.width, this.gameBounds.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(this.gameBounds.width / 2, this.gameBounds.height / 2);

    // Управление камерой (мышь и клавиши)
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

    // Визуализатор программы
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
        this.aimLine?.clear();
        this.aimLine?.setVisible(false);
        this.hintSystem?.reset();
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );
    this.commandPanel.setAllowedCommands(this.level?.allowedCommands || []);
    this.commandPanel.setControlMode(this.controlMode);
    this.commandPanel.setLearningMode(settingsManager.getLearningMode());
    this.updateVisualizer();

    if (this.player) {
      this.inventoryUI = new InventoryUI(this, this.player.getInventory());
    }

    // UI элементы патча 2.0
    this.turretAngleText = this.add.text(10, 70, `Turret: ${this.player.getTurretAngle()}°`, {
      fontSize: '14px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.aimLine = this.add.graphics();
    this.aimLine.setVisible(false);

    this.slowIndicator = this.add.text(10, 95, '🐢 SLOW', {
      fontSize: '14px',
      color: '#88aaff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);
    this.slowIndicator.setVisible(false);

    // Кнопка BACK
    const backLabel = this.isSandboxMode ? '← EDITOR' : '← BACK';
    const backButton = this.add.text(10, 10, backLabel, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    backButton.on('pointerdown', () => {
      this.hintSystem?.destroy();
      this.inventoryUI?.destroy();
      this.commandPanel?.destroy();
      if (this.executionEngine) this.executionEngine.stop();
      if (this.isSandboxMode) {
        this.scene.start('SandboxScene');
      } else {
        this.scene.start('MainMenu');
      }
    });

    // AutoSolve (реальный, через Pathfinder)
    const autoSolveBtn = this.add.text(10, this.cameras.main.height - 40, '🧠 AutoSolve', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#1a1a3a',
      padding: { x: 10, y: 5 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    autoSolveBtn.on('pointerdown', () => {
      this.autoSolve();
    });

    // HintSystem (подробность и тайминги зависят от режима обучения)
    this.hintSystem = new HintSystem(
      this,
      () => this.player?.getPosition() || { col: 0, row: 0 },
      this.pathfinder,
      settingsManager.getLearningMode()
    );
    this.hintSystem.start();

    this.setupExecutionListeners();

    // Обучающий оверлей (forced/optional/off в зависимости от режима обучения)
    new TutorialOverlay(this, settingsManager.getLearningMode()).maybeShow();

    logger.info('GameScene', 'create', 'Scene ready');
  }

  private disableCameraFollowTemporarily(): void {
    if (!this.cameraFollowEnabled) return;
    this.cameraFollowEnabled = false;
    this.cameras.main.stopFollow();
    if (this.followRestoreTimer) this.followRestoreTimer.destroy();
    this.followRestoreTimer = this.time.delayedCall(3000, () => {
      this.cameraFollowEnabled = true;
      if (this.playerSprite) {
        this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
      }
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
    if (!this.level || !this.player || !this.pathfinder) return;

    logger.info('GameScene', 'autoSolve', 'Running Pathfinder...');
    const solution = this.pathfinder.findCommandSolution(this.controlMode);

    if (!solution || solution.length === 0) {
      logger.warn('GameScene', 'autoSolve', 'No solution found');
      const msg = this.add.text(
        this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
        this.cameras.main.centerY,
        '🤷 Решение не найдено',
        { fontSize: '18px', color: '#ffaa00', backgroundColor: '#000000aa', padding: { x: 15, y: 8 } }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
      this.time.delayedCall(2000, () => msg.destroy());
      return;
    }

    logger.info('GameScene', 'autoSolve', `Solution: ${solution.length} commands`);

    // Загружаем команды в панель если есть setCommands
    if (this.commandPanel) {
      this.commandPanel.setCommands(solution);
    }

    // Показываем тост
    const msg = this.add.text(
      this.cameras.main.centerX + this.COMMAND_PANEL_WIDTH,
      this.cameras.main.centerY,
      `🧠 Найдено: ${solution.length} команд`,
      { fontSize: '18px', color: '#00ff88', backgroundColor: '#000000aa', padding: { x: 15, y: 8 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.time.delayedCall(2000, () => msg.destroy());

    // Запускаем решение
    this.runProgram(solution);
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
      this.updateTurretAngleDisplay();
      this.updateSlowIndicator();
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
        if (!this.isSandboxMode) {
          progressManager.completeLevel(this.levelId, stars, steps);
        }
        this.showVictoryMessage(stars, steps);
      } else {
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
    eventBus.on('TURRET_TURNED', () => {
      this.updateTurretAngleDisplay();
    });
    eventBus.on('SHOW_AIM', (payload: any) => {
      this.showAimLine(payload.pos, payload.angle);
    });
    eventBus.on('SLOW_FIELD_ENTERED', () => {
      this.updateSlowIndicator(true);
    });
    eventBus.on('SLOW_FIELD_EXITED', () => {
      this.updateSlowIndicator(false);
    });
    eventBus.on('WINGS_EXPIRED', () => {
      logger.info('GameScene', 'WINGS_EXPIRED', 'Wings effect ended');
    });
  }

  private updateTurretAngleDisplay(): void {
    if (this.turretAngleText && this.player) {
      this.turretAngleText.setText(`Turret: ${this.player.getTurretAngle()}°`);
    }
  }

  private updateSlowIndicator(force?: boolean): void {
    if (!this.slowIndicator) return;
    const isSlow = (force !== undefined) ? force : (this.isOnSlowField());
    this.slowIndicator.setVisible(isSlow);
  }

  private isOnSlowField(): boolean {
    if (!this.level || !this.player) return false;
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === TileType.SLOW_FIELD;
  }

  private showAimLine(pos: Point, angle: number): void {
    if (!this.aimLine) return;
    this.aimLine.clear();
    this.aimLine.setVisible(true);
    this.aimLine.lineStyle(2, 0xff0000, 0.7);
    const startX = pos.col * this.gridSize + this.gridSize / 2;
    const startY = pos.row * this.gridSize + this.gridSize / 2;
    let dx = 0, dy = 0;
    switch (angle) {
      case 0:   dy = -1; break;
      case 90:  dx = 1;  break;
      case 180: dy = 1;  break;
      case 270: dx = -1; break;
      default: return;
    }
    let endX = startX, endY = startY;
    let step = 1;
    while (step < 20) {
      const testX = pos.col + dx * step;
      const testY = pos.row + dy * step;
      if (testX < 0 || testX >= this.level!.width || testY < 0 || testY >= this.level!.height) break;
      const tile = this.level!.map[testY][testX];
      if (tile === TileType.WALL || tile === TileType.HOLE || tile === TileType.BRICK) break;
      endX = testX * this.gridSize + this.gridSize / 2;
      endY = testY * this.gridSize + this.gridSize / 2;
      step++;
    }
    this.aimLine.beginPath();
    this.aimLine.moveTo(startX, startY);
    this.aimLine.lineTo(endX, endY);
    this.aimLine.strokePath();
    this.time.delayedCall(2000, () => {
      this.aimLine?.clear();
      this.aimLine?.setVisible(false);
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
    const level: LevelData = JSON.parse(JSON.stringify(this.originalLevelData));
    this.level = level;
    if (this.player) {
      this.player.teleport(level.startPos);
      this.player.resetInventory();
      this.player.setTrapped(false);
      this.player.setGlued(false, 0);
      this.player.setSlowFactor(1);
      this.player.setTurretAngle(level.startTurretAngle || 0);
      this.player.syncBodyWithTurret();
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
    this.cameraFollowEnabled = true;
    if (this.playerSprite) {
      this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    }
    this.updateTurretAngleDisplay();
    this.updateSlowIndicator(false);
    this.aimLine?.clear();
    this.aimLine?.setVisible(false);
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

    // Сброс подсказок при старте выполнения
    this.hintSystem?.reset();

    this.executionEngine = new ExecutionEngine(this.level!, this.player, this.controlMode);
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
      this.hintSystem?.stop();
      this.inventoryUI?.destroy();
      this.commandPanel?.destroy();
      if (this.isSandboxMode) {
        this.scene.start('SandboxScene');
      } else {
        this.scene.start('VictoryScreen', { levelId: this.levelId, stars: stars, stepsUsed: steps });
      }
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

  // Размещает спрайт по ключу текстуры в центре клетки, масштабируя под gridSize.
  private placeSprite(key: string, col: number, row: number, scale = 1): Phaser.GameObjects.Image {
    const cx = col * this.gridSize + this.gridSize / 2;
    const cy = row * this.gridSize + this.gridSize / 2;
    const img = this.add.image(cx, cy, key);
    const target = this.gridSize * scale;
    img.setDisplaySize(target, target);
    this.gameContainer?.add(img);
    return img;
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

        // Фон клетки (лёгкая сетка)
        const bgRect = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x2d2d3a, 0.35);
        bgRect.setOrigin(0, 0);
        bgRect.setStrokeStyle(1, 0x44445a);
        this.gameContainer?.add(bgRect);

        // Спрайт тайла (из public/ или рисованный фолбэк); PLATFORM оставляем пустым фоном
        if (tile !== TileType.PLATFORM) {
          this.placeSprite(tileTextureKey(tile), col, row, 0.92);
        }

        // Спрайт предмета (поверх тайла)
        const itemHere = items.find((it: any) => it.pos?.col === col && it.pos?.row === row);
        if (itemHere) {
          this.placeSprite(itemTextureKey(itemHere.id), col, row, 0.7);
        }

        // Спрайт монстра (поверх всего)
        const monsterHere = monsters.find((m: any) => m.position?.col === col && m.position?.row === row);
        if (monsterHere) {
          this.placeSprite(monsterTextureKey(monsterHere.type), col, row, 0.85);
        }
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) { this.playerSprite.destroy(); this.playerSprite = null; }
    if (this.turretSprite) { this.turretSprite.destroy(); this.turretSprite = null; }
    if (!this.level || !this.player) return;

    const pos = this.player.getPosition();
    const x = pos.col * this.gridSize + this.gridSize / 2;
    const y = pos.row * this.gridSize + this.gridSize / 2;
    const angle = this.player.getTurretAngle();

    // Корпус танка: выбираем спрайт по направлению корпуса (фолбэк — player)
    const hullDir = this.player.getHullDirection();
    const hullKey = `player_${hullDir}`;
    const bodyKey = this.textures.exists(hullKey) ? hullKey : 'player';
    this.playerSprite = this.add.image(x, y, bodyKey);
    this.playerSprite.setDisplaySize(this.gridSize * 0.92, this.gridSize * 0.92);
    this.gameContainer?.add(this.playerSprite);

    // Ствол/башня: отдельный индикатор угла башни (раздельное управление)
    const aim = this.add.triangle(
      x, y,
      0, -this.gridSize * 0.42,
      -this.gridSize * 0.1, -this.gridSize * 0.22,
      this.gridSize * 0.1, -this.gridSize * 0.22,
      0x00ffcc, 1
    );
    aim.setAngle(angle); // 0=вверх, 90=вправо, 180=вниз, 270=влево
    this.gameContainer?.add(aim);

    if (this.cameraFollowEnabled) {
      this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    }
  }
}
