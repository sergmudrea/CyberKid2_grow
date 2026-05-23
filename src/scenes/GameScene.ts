import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';

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
  private commandPanel: CommandPanel;
  private isRunning: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.playerPos = { ...this.levelData.startPos };
    this.coinPos = { ...this.levelData.coinPos };
    this.isRunning = false;
  }

  create(): void {
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {}, // onClear
      () => this.saveProgram(),
      () => this.loadProgram()
    );

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
  }

  private saveProgram(): void {
    const commands = this.commandPanel.getCommands();
    localStorage.setItem('saved_program', JSON.stringify(commands));
    alert('Program saved!');
  }

  private loadProgram(): void {
    const saved = localStorage.getItem('saved_program');
    if (saved) {
      const commands = JSON.parse(saved) as Command[];
      this.commandPanel.loadProgram(commands);
      alert('Program loaded!');
    } else {
      alert('No saved program found');
    }
  }

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.playerPos = { ...this.levelData.startPos };
    this.drawPlayer();
    this.executeCommands(commands, 0);
  }

  private executeCommands(commands: Command[], index: number): void {
    if (index >= commands.length) {
      this.isRunning = false;
      this.checkVictory();
      return;
    }

    const cmd = commands[index];
    let dx = 0, dy = 0;
    if (cmd === 'up') dy = -1;
    if (cmd === 'down') dy = 1;
    if (cmd === 'left') dx = -1;
    if (cmd === 'right') dx = 1;

    const newCol = this.playerPos.col + dx;
    const newRow = this.playerPos.row + dy;
    if (newCol >= 0 && newCol < this.levelData.width && newRow >= 0 && newRow < this.levelData.height) {
      this.playerPos = { col: newCol, row: newRow };
      this.drawPlayer();
    }

    this.time.delayedCall(200, () => {
      this.executeCommands(commands, index + 1);
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

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      alert('Victory!');
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    }
  }
}
