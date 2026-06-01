// src/modules/ProgramVisualizer.ts
// ============================================================================
// ВИЗУАЛИЗАТОР ПРОГРАММЫ (РИСУЕТ ТРАЕКТОРИЮ НА КАРТЕ)
// ============================================================================
// Получает список команд (Command[]) и отображает на игровом поле стрелки,
// показывающие путь, который пройдёт игрок при выполнении программы.
// Красный крестик обозначает выход за границу или столкновение с препятствием.
// ============================================================================

import { Scene } from 'phaser';
import { Command } from '../types/index';

export class ProgramVisualizer {
  private scene: Scene;
  private gridSize: number;
  private arrows: Phaser.GameObjects.Text[] = [];

  constructor(scene: Scene, gridSize: number) {
    this.scene = scene;
    this.gridSize = gridSize;
  }

  // --------------------------------------------------------------------------
  // ОСНОВНОЙ МЕТОД: ОБНОВИТЬ ВИЗУАЛИЗАЦИЮ ПО КОМАНДАМ
  // --------------------------------------------------------------------------
  public updateVisuals(
    commands: Command[],
    startCol: number,
    startRow: number,
    width: number,
    height: number,
    gridSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    this.clear();

    if (!commands.length) return;

    let col = startCol;
    let row = startRow;

    for (const cmd of commands) {
      let dx = 0, dy = 0;
      let symbol = '';
      switch (cmd) {
        case Command.UP:    dy = -1; symbol = '↑'; break;
        case Command.DOWN:  dy = 1;  symbol = '↓'; break;
        case Command.LEFT:  dx = -1; symbol = '←'; break;
        case Command.RIGHT: dx = 1;  symbol = '→'; break;
        default: continue; // другие команды не визуализируем
      }

      const newCol = col + dx;
      const newRow = row + dy;

      if (newCol >= 0 && newCol < width && newRow >= 0 && newRow < height) {
        const x = offsetX + newCol * gridSize + gridSize / 2;
        const y = offsetY + newRow * gridSize + gridSize / 2;
        const arrow = this.scene.add.text(x, y, symbol, {
          fontSize: `${Math.floor(gridSize * 0.6)}px`,
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
        this.arrows.push(arrow);
        col = newCol;
        row = newRow;
      } else {
        // Если выход за границы – рисуем крестик в предполагаемой позиции (за границей)
        const x = offsetX + (col + dx) * gridSize + gridSize / 2;
        const y = offsetY + (row + dy) * gridSize + gridSize / 2;
        const cross = this.scene.add.text(x, y, '❌', {
          fontSize: `${Math.floor(gridSize * 0.6)}px`,
          color: '#ff0000',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
        this.arrows.push(cross);
        break; // дальнейшие команды не рисуем, так как путь прерван
      }
    }
  }

  // --------------------------------------------------------------------------
  // ОЧИСТКА ВСЕХ НАРИСОВАННЫХ СТРЕЛОК
  // --------------------------------------------------------------------------
  public clear(): void {
    this.arrows.forEach(arrow => arrow.destroy());
    this.arrows = [];
  }
}
