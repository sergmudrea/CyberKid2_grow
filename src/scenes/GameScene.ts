import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';

export class GameScene extends Scene {
  private levelData = {
    id: 'test_001',
    name: 'Test Level',
    worldId: 'meadow',
    width: 5,
    height: 5,
    map: [
      [0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
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
  private visualizer: ProgramVisualizer;
  private isRunning: boolean = false;
  private isBroken: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.playerPos = { ...this.levelData.startPos };
    this.coinPos = { ...this.levelData.coinPos };
    this.isRunning = false;
    this.isBroken = false;
  }

  create(): void {
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.visualizer.clear();
      },
      () => this.saveProgram(),
      () => {
        const commands = this.commandPanel.getCommands();
        this.visualizer.updateVisuals(
          commands,
          this.levelData.startPos.col,
          this.levelData.startPos.row,
          this.levelData.width,
          this.levelData.height
        );
      }
    );

    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.visualizer.updateVisuals(
      this.commandPanel.getCommands(),
      this.levelData.startPos.col,
      this.levelData.startPos.row,
      this.levelData.width,
      this.levelData.height
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
      this.visualizer.updateVisuals(
        commands,
        this.levelData.startPos.col,
        this.levelData.startPos.row,
        this.levelData.width,
        this.levelData.height
      );
      alert('Program loaded!');
    } else {
      alert('No saved program found');
    }
  }

  private runProgram(commands: Command[]): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isBroken = false;
    this.playerPos = { ...this.levelData.startPos };
    this.drawPlayer();
    this.executeCommands(commands, 0);
  }

  private executeCommands(commands: Command[], index: number): void {
    // Если робот сломан, останавливаем выполнение
    if (this.isBroken) {
      this.isRunning = false;
      this.showBrokenMessage();
      return;
    }

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

    const isWall = this.levelData.map[newRow]?.[newCol] === 1;
    const isOutOfBounds = newCol < 0 || newCol >= this.levelData.width || newRow < 0 || newRow >= this.levelData.height;

    if (!isWall && !isOutOfBounds) {
      this.playerPos = { col: newCol, row: newRow };
      this.drawPlayer();
      // Продолжаем выполнение следующей команды
      this.time.delayedCall(200, () => {
        this.executeCommands(commands, index + 1);
      });
    } else {
      // Столкновение — робот сломан
      this.isBroken = true;
      
      // Визуальный эффект столкновения
      const collisionX = (this.playerPos.col + dx) * this.gridSize;
      const collisionY = (this.playerPos.row + dy) * this.gridSize;
      const flash = this.add.rectangle(collisionX, collisionY, this.gridSize, this.gridSize, 0xff0000, 0.8).setOrigin(0, 0);
      this.time.delayedCall(300, () => flash.destroy());
      
      // Меняем цвет игрока на красный
      this.playerSprite.setFillStyle(0xff0000);
      
      // Показываем сообщение о поломке
      this.showBrokenMessage();
      
      this.isRunning = false;
      // Дальнейшие команды не выполняются
    }
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
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, this.isBroken ? 0xff0000 : 0x00ff00).setOrigin(0, 0);
  }

  private drawCoin(): void {
    if (this.coinSprite) this.coinSprite.destroy();
    const x = this.coinPos.col * this.gridSize;
    const y = this.coinPos.row * this.gridSize;
    this.coinSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00).setOrigin(0, 0);
  }

  private checkVictory(): void {
    if (!this.isBroken && this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      alert('Victory!');
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    }
  }
}
