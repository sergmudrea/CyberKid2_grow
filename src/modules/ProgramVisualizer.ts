import { Scene } from 'phaser';
import { Command } from './CommandPanel';

export class ProgramVisualizer {
  private scene: Scene;
  private gridSize: number;
  private arrows: Phaser.GameObjects.Text[] = [];

  constructor(scene: Scene, gridSize: number) {
    this.scene = scene;
    this.gridSize = gridSize;
  }

  public updateVisuals(commands: Command[], startCol: number, startRow: number, width: number, height: number, offsetX: number, offsetY: number): void {
    this.clear();
    if (!commands.length) return;

    let col = startCol;
    let row = startRow;

    for (const cmd of commands) {
      let dx = 0, dy = 0;
      let symbol = '';
      if (cmd === 'up') { dy = -1; symbol = '↑'; }
      if (cmd === 'down') { dy = 1; symbol = '↓'; }
      if (cmd === 'left') { dx = -1; symbol = '←'; }
      if (cmd === 'right') { dx = 1; symbol = '→'; }

      const newCol = col + dx;
      const newRow = row + dy;

      if (newCol >= 0 && newCol < width && newRow >= 0 && newRow < height) {
        const x = offsetX + newCol * this.gridSize + this.gridSize / 2;
        const y = offsetY + newRow * this.gridSize + this.gridSize / 2;
        const arrow = this.scene.add.text(x, y, symbol, {
          fontSize: `${Math.floor(this.gridSize * 0.6)}px`,
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
        this.arrows.push(arrow);
        col = newCol;
        row = newRow;
      } else {
        const x = offsetX + (col + dx) * this.gridSize + this.gridSize / 2;
        const y = offsetY + (row + dy) * this.gridSize + this.gridSize / 2;
        const cross = this.scene.add.text(x, y, '❌', {
          fontSize: `${Math.floor(this.gridSize * 0.6)}px`,
          color: '#ff0000',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
        this.arrows.push(cross);
        break;
      }
    }
  }

  public clear(): void {
    this.arrows.forEach(arrow => arrow.destroy());
    this.arrows = [];
  }
}
