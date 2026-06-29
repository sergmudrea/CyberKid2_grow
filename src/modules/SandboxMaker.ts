// src/modules/SandboxMaker.ts
// ============================================================================
// РЕДАКТОР УРОВНЕЙ (SANDBOX MAKER)
// ============================================================================
// Рисует на Phaser-сцене сетку (по умолчанию 10x10).
// Палитра тайлов слева, клик по клетке = поставить тайл,
// ПКМ = очистить в PLATFORM.
// Кнопки: Clear, Save, Test, Back.
// ============================================================================

import Phaser from 'phaser';
import { TileType, LevelData, ControlMode } from '../types/index';
import { tileTextureKey } from '../managers/AssetManager';
import { logger } from '../core/Logger';

const SANDBOX_STORAGE_KEY = 'cyberkid_sandbox_levels';
const GRID_COLS = 10;
const GRID_ROWS = 10;
const CELL_SIZE = 48;
const PALETTE_X = 10;
const PALETTE_Y = 80;
const GRID_OFFSET_X = 180;
const GRID_OFFSET_Y = 60;

// Тайлы в палитре
const PALETTE_TILES: TileType[] = [
  TileType.PLATFORM,
  TileType.WALL,
  TileType.HOLE,
  TileType.GOAL,
  TileType.START,
  TileType.BRICK,
  TileType.MAGNET,
  TileType.SLOW_FIELD,
];

const TILE_LABELS: Partial<Record<TileType, string>> = {
  [TileType.PLATFORM]: 'Platform',
  [TileType.WALL]:     'Wall',
  [TileType.HOLE]:     'Hole',
  [TileType.GOAL]:     'Goal',
  [TileType.START]:    'Start',
  [TileType.BRICK]:    'Brick',
  [TileType.MAGNET]:   'Magnet',
  [TileType.SLOW_FIELD]: 'Slow',
};

export class SandboxMaker {
  private scene: Phaser.Scene;
  private map: TileType[][];
  private selectedTile: TileType = TileType.WALL;
  private cellSprites: Phaser.GameObjects.Image[][] = [];
  private paletteGroup: Phaser.GameObjects.Group;
  private selectedHighlight: Phaser.GameObjects.Rectangle | null = null;
  private onTest: (level: LevelData) => void;
  private onBack: () => void;
  private container: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    onTest: (level: LevelData) => void,
    onBack: () => void
  ) {
    this.scene = scene;
    this.onTest = onTest;
    this.onBack = onBack;
    this.map = this.createEmptyMap();
    this.paletteGroup = scene.add.group();
    this.container = scene.add.container(0, 0);

    this.drawPalette();
    this.drawGrid();
    this.drawButtons();
    this.setupInput();
  }

  private createEmptyMap(): TileType[][] {
    return Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(TileType.PLATFORM)
    );
  }

  private drawPalette(): void {
    // Заголовок
    this.scene.add.text(PALETTE_X, 40, '🎨 PALETTE', {
      fontSize: '13px',
      color: '#00ffcc',
      fontFamily: 'monospace',
    });

    PALETTE_TILES.forEach((tile, i) => {
      const y = PALETTE_Y + i * 52;
      const key = tileTextureKey(tile);

      // Фон иконки
      const bg = this.scene.add.rectangle(PALETTE_X + 24, y + 24, 48, 48, 0x22223a)
        .setInteractive({ useHandCursor: true });

      const img = this.scene.add.image(PALETTE_X + 24, y + 24, key).setDisplaySize(40, 40);

      const label = this.scene.add.text(PALETTE_X + 52, y + 18, TILE_LABELS[tile] || `${tile}`, {
        fontSize: '11px',
        color: '#cccccc',
        fontFamily: 'monospace',
      });

      // Подсветка выбранного
      if (tile === this.selectedTile) {
        bg.setStrokeStyle(2, 0x00ffcc);
      }

      bg.on('pointerdown', () => {
        this.selectedTile = tile;
        this.refreshPaletteHighlight();
      });

      this.paletteGroup.add(bg);
      this.paletteGroup.add(img as any);
      this.paletteGroup.add(label as any);
    });
  }

  private refreshPaletteHighlight(): void {
    // Снимаем все highlight, ставим нужный
    const items = this.paletteGroup.getChildren();
    let idx = 0;
    PALETTE_TILES.forEach((tile, i) => {
      const bg = items[idx] as Phaser.GameObjects.Rectangle;
      if (tile === this.selectedTile) {
        bg.setStrokeStyle(2, 0x00ffcc);
      } else {
        bg.setStrokeStyle(1, 0x444466);
      }
      idx += 3; // bg + img + label
    });
  }

  private drawGrid(): void {
    // Очищаем старые спрайты
    for (const row of this.cellSprites) {
      for (const img of row) {
        img?.destroy();
      }
    }
    this.cellSprites = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      const rowSprites: Phaser.GameObjects.Image[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const x = GRID_OFFSET_X + col * CELL_SIZE;
        const y = GRID_OFFSET_Y + row * CELL_SIZE;

        // Фон клетки
        const bg = this.scene.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x22223a)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x444466);
        (bg as any).__gridCell = true;

        const tile = this.map[row][col];
        const key = tileTextureKey(tile);
        let img: Phaser.GameObjects.Image;

        if (tile === TileType.PLATFORM) {
          img = this.scene.add.image(x + CELL_SIZE / 2, y + CELL_SIZE / 2, key)
            .setDisplaySize(CELL_SIZE, CELL_SIZE)
            .setAlpha(0.15);
        } else {
          img = this.scene.add.image(x + CELL_SIZE / 2, y + CELL_SIZE / 2, key)
            .setDisplaySize(CELL_SIZE * 0.9, CELL_SIZE * 0.9);
        }

        rowSprites.push(img);
      }
      this.cellSprites.push(rowSprites);
    }
  }

  private setupInput(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointer(pointer);
    });
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.handlePointer(pointer);
      }
    });
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    const px = pointer.x - GRID_OFFSET_X;
    const py = pointer.y - GRID_OFFSET_Y;

    if (px < 0 || py < 0) return;

    const col = Math.floor(px / CELL_SIZE);
    const row = Math.floor(py / CELL_SIZE);

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const newTile = pointer.rightButtonDown() ? TileType.PLATFORM : this.selectedTile;

    // Если кладём START — убираем предыдущий START
    if (newTile === TileType.START) {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (this.map[r][c] === TileType.START) {
            this.map[r][c] = TileType.PLATFORM;
          }
        }
      }
    }
    // Если кладём GOAL — убираем предыдущий GOAL
    if (newTile === TileType.GOAL) {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (this.map[r][c] === TileType.GOAL) {
            this.map[r][c] = TileType.PLATFORM;
          }
        }
      }
    }

    if (this.map[row][col] !== newTile) {
      this.map[row][col] = newTile;
      this.redrawCell(col, row);
    }
  }

  private redrawCell(col: number, row: number): void {
    const img = this.cellSprites[row]?.[col];
    if (!img) return;

    const tile = this.map[row][col];
    const key = tileTextureKey(tile);
    img.setTexture(key);

    if (tile === TileType.PLATFORM) {
      img.setAlpha(0.15);
    } else {
      img.setAlpha(1);
    }
  }

  private drawButtons(): void {
    const btnY = GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE + 20;
    const btnStyle = {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 8 },
    };

    // Clear
    const clearBtn = this.scene.add.text(GRID_OFFSET_X, btnY, '🗑 Clear', btnStyle)
      .setInteractive({ useHandCursor: true });
    clearBtn.on('pointerdown', () => {
      this.map = this.createEmptyMap();
      this.drawGrid();
    });

    // Save
    const saveBtn = this.scene.add.text(GRID_OFFSET_X + 100, btnY, '💾 Save', btnStyle)
      .setInteractive({ useHandCursor: true });
    saveBtn.on('pointerdown', () => {
      this.saveLevel();
    });

    // Test
    const testBtn = this.scene.add.text(GRID_OFFSET_X + 200, btnY, '▶ Test', {
      ...btnStyle,
      backgroundColor: '#1a6a2a',
    }).setInteractive({ useHandCursor: true });
    testBtn.on('pointerdown', () => {
      const level = this.buildLevelData();
      if (level) {
        this.onTest(level);
      } else {
        this.showError('Установи START и GOAL на карте!');
      }
    });

    // Back
    const backBtn = this.scene.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(100);
    backBtn.on('pointerdown', () => this.onBack());
  }

  private buildLevelData(): LevelData | null {
    // Ищем START и GOAL
    let startPos = { col: 0, row: 0 };
    let coinPos = { col: GRID_COLS - 1, row: GRID_ROWS - 1 };
    let hasStart = false;
    let hasGoal = false;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.map[row][col] === TileType.START) {
          startPos = { col, row };
          hasStart = true;
        }
        if (this.map[row][col] === TileType.GOAL) {
          coinPos = { col, row };
          hasGoal = true;
        }
      }
    }

    if (!hasStart || !hasGoal) return null;

    const level: LevelData = {
      id: 'sandbox_test',
      name: 'Sandbox Level',
      worldId: 'arcade',
      width: GRID_COLS,
      height: GRID_ROWS,
      map: this.map.map(row => [...row]),
      startPos,
      startTurretAngle: 0,
      startHullDirection: 'right',
      coinPos,
      controlMode: ControlMode.SEPARATE,
    };

    return level;
  }

  private saveLevel(): void {
    try {
      const level = this.buildLevelData();
      if (!level) {
        this.showError('Установи START и GOAL!');
        return;
      }
      const saved = JSON.parse(localStorage.getItem(SANDBOX_STORAGE_KEY) || '[]') as LevelData[];
      const existing = saved.findIndex(l => l.id === 'sandbox_test');
      if (existing >= 0) {
        saved[existing] = level;
      } else {
        saved.push(level);
      }
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(saved));
      logger.info('SandboxMaker', 'saveLevel', 'Level saved');
      this.showToast('Уровень сохранён!');
    } catch (e) {
      logger.error('SandboxMaker', 'saveLevel', 'Failed to save', e);
    }
  }

  private showToast(text: string): void {
    const width = this.scene.cameras.main.width;
    const toast = this.scene.add.text(width / 2, 40, text, {
      fontSize: '16px',
      color: '#00ffcc',
      backgroundColor: '#000000aa',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.scene.time.delayedCall(2000, () => toast.destroy());
  }

  private showError(text: string): void {
    const width = this.scene.cameras.main.width;
    const err = this.scene.add.text(width / 2, 40, `⚠️ ${text}`, {
      fontSize: '16px',
      color: '#ff4444',
      backgroundColor: '#000000aa',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.scene.time.delayedCall(2500, () => err.destroy());
  }

  destroy(): void {
    for (const row of this.cellSprites) {
      for (const img of row) img?.destroy();
    }
    this.paletteGroup.destroy(true);
    this.container.destroy();
  }
}
