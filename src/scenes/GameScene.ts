import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';

export class GameScene extends Scene {
  private levelData = {
    id: 'test_001',
    name: 'Test Level',
    worldId: 'meadow',
    width: 20,
    height: 20,
    map: [] as number[][],
    startPos: { col: 0, row: 0 },
    coinPos: { col: 19, row: 19 },
  };
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 32;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private coinSprite: Phaser.GameObjects.Rectangle;
  private commandPanel: CommandPanel;
  private visualizer: ProgramVisualizer;
  private isRunning: boolean = false;
  private isBroken: boolean = false;
  private isVictory: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    // Генерируем карту 20x20 (все платформы, без стен)
    this.levelData.map = Array(20).fill(null).map(() => Array(20).fill(0));
    this.playerPos = { ...this.levelData.startPos };
    this.coinPos = { ...this.levelData.coinPos };
    this.isRunning = false;
    this.isBroken = false;
    this.isVictory = false;
  }

  create(): void {
    // Динамическое центрирование игрового поля
    const gameWidth = this.levelData.width * this.gridSize;
    const gameHeight = this.levelData.height * this.gridSize;
    const offsetX = (this.cameras.main.width - gameWidth) / 2;
    const offsetY = (this.cameras.main.height - gameHeight) / 2;
    
    this.drawGrid(offsetX, offsetY);
    this.drawPlayer(offsetX, offsetY);
    this.drawCoin(offsetX, offsetY);

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetRobot();
        this.visualizer.clear();
        this.isBroken = false;
        this.isVictory = false;
        this.drawPlayer(offsetX, offsetY);
        this.updateVisualizer(offsetX, offsetY);
      },
      (commands: Command[]) => {
        this.updateVisualizer(offsetX, offsetY);
      }
    );

    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer(offsetX, offsetY);

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
  }

  private updateVisualizer(offsetX: number, offsetY: number): void {
    const commands = this.commandPanel.getCommands();
    this.visualizer.updateVisuals(
      commands,
      this.levelData.startPos.col,
      this.levelData.startPos.row,
      this.levelData.width,
      this.levelData.height,
      offsetX,
      offsetY
    );
  }

  private resetRobot(): void {
    this.playerPos = { ...this.levelData.startPos };
    this.isBroken = false;
    this.isVictory = false;
  }

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    if (this.isVictory) {
      alert('You already won! Start a new game.');
      return;
    }
    this.isRunning = true;
    this.isBroken = false;
    this.playerPos = { ...this.levelData.startPos };
    const gameWidth = this.levelData.width * this.gridSize;
    const gameHeight = this.levelData.height * this.gridSize;
    const offsetX = (this.cameras.main.width - gameWidth) / 2;
    const offsetY = (this.cameras.main.height - gameHeight) / 2;
    this.drawPlayer(offsetX, offsetY);
    this.executeCommands(commands, 0, offsetX, offsetY);
  }

  private executeCommands(commands: Command[], index: number, offsetX: number, offsetY: number): void {
    if (this.isVictory) {
      this.isRunning = false;
      return;
    }
    if (this.isBroken) {
      this.isRunning = false;
      this.showBrokenMessage();
      return;
    }
    if (index >= commands.length) {
      this.isRunning = false;
      if (!this.isVictory && !this.isBroken) this.checkVictory();
      return;
    }

    const cmd = commands[index];
    let dx = 0, dy = 0;
    if (cmd === 'up') dy = -1;
    if (cmd === 'down') dy = 1;
    if (cmd === 'left') dx = -1;
    if (cmd === 'right') dx = 1;

    const targetCol = this.playerPos.col + dx;
    const targetRow = this.playerPos.row + dy;
    const collisionCell = { col: targetCol, row: targetRow };
    const isWall = this.levelData.map[targetRow]?.[targetCol] === 1;
    const isOutOfBounds = targetCol < 0 || targetCol >= this.levelData.width || targetRow < 0 || targetRow >= this.levelData.height;

    if (!isWall && !isOutOfBounds) {
      this.playerPos = { col: targetCol, row: targetRow };
      this.drawPlayer(offsetX, offsetY);
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        this.isVictory = true;
        this.isRunning = false;
        this.showVictoryMessage();
        return;
      }
      this.time.delayedCall(100, () => this.executeCommands(commands, index + 1, offsetX, offsetY));
    } else {
      this.isBroken = true;
      this.showGhostAt(collisionCell, offsetX, offsetY);
      const collisionX = offsetX + collisionCell.col * this.gridSize;
      const collisionY = offsetY + collisionCell.row * this.gridSize;
      const flash = this.add.rectangle(collisionX, collisionY, this.gridSize, this.gridSize, 0xff0000, 0.8).setOrigin(0, 0);
      this.time.delayedCall(300, () => flash.destroy());
      this.playerSprite.setFillStyle(0xff0000);
      this.showBrokenMessage();
      this.isRunning = false;
    }
  }

  private showGhostAt(cell: { col: number; row: number }, offsetX: number, offsetY: number): void {
    const x = offsetX + cell.col * this.gridSize;
    const y = offsetY + cell.row * this.gridSize;
    const ghost = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00, 0.3).setOrigin(0, 0);
    this.time.delayedCall(500, () => ghost.destroy());
  }

  private showBrokenMessage(): void {
    const width = this.cameras.main.width;
    const msg = this.add.text(width / 2, 100, '💥 ROBOT BROKEN! 💥', {
      fontSize: '24px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);
    this.time.delayedCall(2000, () => msg.destroy());
  }

  private showVictoryMessage(): void {
    const width = this.cameras.main.width;
    const msg = this.add.text(width / 2, 100, '🏆 VICTORY! 🏆', {
      fontSize: '28px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      alert('Victory!');
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
  }

  private drawGrid(offsetX: number, offsetY: number): void {
    const { width, height, map } = this.levelData;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = offsetX + col * this.gridSize;
        const y = offsetY + row * this.gridSize;
        const color = map[row][col] === 1 ? 0x555555 : 0x8B5A2B;
        this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0).setStrokeStyle(1, 0xaaaaaa);
      }
    }
  }

  private drawPlayer(offsetX: number, offsetY: number): void {
    if (this.playerSprite) this.playerSprite.destroy();
    const x = offsetX + this.playerPos.col * this.gridSize;
    const y = offsetY + this.playerPos.row * this.gridSize;
    const color = this.isBroken ? 0xff0000 : (this.isVictory ? 0xffcc00 : 0x00ff00);
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
  }

  private drawCoin(offsetX: number, offsetY: number): void {
    if (this.coinSprite) this.coinSprite.destroy();
    const x = offsetX + this.coinPos.col * this.gridSize;
    const y = offsetY + this.coinPos.row * this.gridSize;
    this.coinSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00).setOrigin(0, 0);
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      this.isVictory = true;
      this.showVictoryMessage();
    }
  }
}
