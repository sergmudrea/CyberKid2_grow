import { Scene } from 'phaser';
import { Command } from './CommandPanel';

export class ProgramVisualizer {
  private scene: Scene;
  private gridSize: number;
  private arrows: Map<number, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Scene, gridSize: number) {
    this.scene = scene;
    this.gridSize = gridSize;
  }

  public updateVisuals(commands: Command[], startCol: number, startRow: number): void {
    // Очищаем старые стрелки
    this.arrows.forEach(arrow => arrow.destroy());
    this.arrows.clear();

    let col = startCol;
    let row = startRow;
    let step = 1;

    for (const cmd of commands) {
      let dx = 0, dy = 0;
      let symbol = '';
      if (cmd === 'up') { dy = -1; symbol = '↑'; }
      if (cmd === 'down') { dy = 1; symbol = '↓'; }
      if (cmd === 'left') { dx = -1; symbol = '←'; }
      if (cmd === 'right') { dx = 1; symbol = '→'; }

      const newCol = col + dx;
      const newRow = row + dy;

      // Проверка границ (не выходим за поле)
      if (newCol >= 0 && newCol < 5 && newRow >= 0 && newRow < 5) {
        const x = newCol * this.gridSize + this.gridSize / 2;
        const y = newRow * this.gridSize + this.gridSize / 2;
        const arrow = this.scene.add.text(x, y, symbol, {
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
        this.arrows.set(step, arrow);
        col = newCol;
        row = newRow;
      }
      step++;
    }
  }

  public clear(): void {
    this.arrows.forEach(arrow => arrow.destroy());
    this.arrows.clear();
  }
}
