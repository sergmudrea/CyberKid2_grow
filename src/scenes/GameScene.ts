import { Scene } from 'phaser';
import { TileType, Point } from '../types/index';

export class GameScene extends Scene {
  private levelData = {
    width: 5,
    height: 5,
    map: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    startPos: { col: 0, row: 0 },
    coinPos: { col: 4, row: 4 },
  };
  private playerPos: Point;
  private coinPos: Point;
  private gridSize: number = 64;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private coinSprite: Phaser.GameObjects.Rectangle;
  private moveButton: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.playerPos = { ...this.levelData.startPos };
    this.coinPos = { ...this.levelData.coinPos };
  }

  create(): void {
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();
    this.createUI();

    // Добавляем кнопку возврата (как было)
    const backButton = this.add.text(10, 60, '← BACK', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });
  }

  private drawGrid(): void {
    const { width, height, map } = this.levelData;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        const color = map[row][col] === 1 ? 0x555555 : 0x8B5A2B;
        this.add.rectangle(x, y, this.gridSize, this.gridSize, color)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0xaaaaaa);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00).setOrigin(0, 0);
  }

  private drawCoin(): void {
    if (this.coinSprite) this.coinSprite.destroy();
    const x = this.coinPos.col * this.gridSize;
    const y = this.coinPos.row * this.gridSize;
    this.coinSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00).setOrigin(0, 0);
  }

  private createUI(): void {
    this.moveButton = this.add.text(10, 10, '→ Move Right', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setInteractive({ useHandCursor: true });
    this.moveButton.on('pointerdown', () => this.movePlayerRight());
  }

  private movePlayerRight(): void {
    const newPos = { col: this.playerPos.col + 1, row: this.playerPos.row };
    if (newPos.col < this.levelData.width) {
      this.playerPos = newPos;
      this.drawPlayer();
      this.checkVictory();
    }
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      alert('Victory!');
      this.scene.start('MainMenu');
    }
  }
}
