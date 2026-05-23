import { Scene } from 'phaser';

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
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 64;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private coinSprite: Phaser.GameObjects.Rectangle;

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
    // Кнопки движения
    const btnUp = this.add.text(10, 10, '↑ Up', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    btnUp.on('pointerdown', () => this.movePlayer(0, -1));

    const btnDown = this.add.text(80, 10, '↓ Down', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    btnDown.on('pointerdown', () => this.movePlayer(0, 1));

    const btnLeft = this.add.text(150, 10, '← Left', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    btnLeft.on('pointerdown', () => this.movePlayer(-1, 0));

    const btnRight = this.add.text(220, 10, '→ Right', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    btnRight.on('pointerdown', () => this.movePlayer(1, 0));

    // Кнопка назад
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

  private movePlayer(dx: number, dy: number): void {
    const newCol = this.playerPos.col + dx;
    const newRow = this.playerPos.row + dy;
    if (newCol >= 0 && newCol < this.levelData.width && newRow >= 0 && newRow < this.levelData.height) {
      this.playerPos = { col: newCol, row: newRow };
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
