import { Scene } from 'phaser';
import { CommandPanel, Command } from '../modules/CommandPanel';
import { ProgramVisualizer } from '../modules/ProgramVisualizer';

export class GameScene extends Scene {
  private levelData = {
    id: 'test_001',
    name: 'Test Level',
    worldId: 'meadow',
    width: 15,
    height: 15,
    map: [] as number[][],
    startPos: { col: 0, row: 0 },
    coinPos: { col: 14, row: 14 },
  };
  private playerPos: { col: number; row: number };
  private coinPos: { col: number; row: number };
  private gridSize: number = 40;
  private playerSprite: Phaser.GameObjects.Rectangle;
  private coinSprite: Phaser.GameObjects.Rectangle;
  private commandPanel: CommandPanel;
  private visualizer: ProgramVisualizer;
  private isRunning: boolean = false;
  private isBroken: boolean = false;
  private isVictory: boolean = false;
  private cameraFollow: Phaser.Cameras.Scene2D.Camera;
  private gameContainer: Phaser.GameObjects.Container;
  private gameBounds: { width: number; height: number };
  private gameOffsetX: number = 0;
  private gameOffsetY: number = 0;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    // Генерируем карту 15x15 (все платформы)
    this.levelData.map = Array(15).fill(null).map(() => Array(15).fill(0));
    this.playerPos = { ...this.levelData.startPos };
    this.coinPos = { ...this.levelData.coinPos };
    this.isRunning = false;
    this.isBroken = false;
    this.isVictory = false;
  }

  create(): void {
    // Создаём контейнер для игрового поля
    this.gameContainer = this.add.container(0, 0);
    
    this.gameBounds = {
      width: this.levelData.width * this.gridSize,
      height: this.levelData.height * this.gridSize
    };
    
    // Вычисляем смещение для центрирования поля
    this.gameOffsetX = (this.cameras.main.width - this.gameBounds.width) / 2;
    this.gameOffsetY = (this.cameras.main.height - this.gameBounds.height) / 2;
    
    // Смещаем контейнер для центрирования
    this.gameContainer.setPosition(this.gameOffsetX, this.gameOffsetY);
    
    this.drawGrid();
    this.drawPlayer();
    this.drawCoin();

    // Настройка камеры для следования за игроком (относительно контейнера)
    this.cameraFollow = this.cameras.main;
    this.cameraFollow.setBounds(this.gameOffsetX, this.gameOffsetY, this.gameBounds.width, this.gameBounds.height);
    this.cameraFollow.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameraFollow.setZoom(1);
    this.cameraFollow.centerOn(
      this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2,
      this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2
    );

    this.commandPanel = new CommandPanel(
      this,
      (commands: Command[]) => this.runProgram(commands),
      () => {
        this.resetRobot();
        this.visualizer.clear();
        this.isBroken = false;
        this.isVictory = false;
        this.drawPlayer();
        this.updateVisualizer();
        this.cameraFollow.centerOn(
          this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2,
          this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2
        );
      },
      (commands: Command[]) => {
        this.updateVisualizer();
      }
    );

    this.visualizer = new ProgramVisualizer(this, this.gridSize);
    this.updateVisualizer();

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
      depth: 100,
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.commandPanel.destroy();
      this.scene.start('MainMenu');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
  }

  private updateVisualizer(): void {
    const commands = this.commandPanel.getCommands();
    this.visualizer.updateVisuals(
      commands,
      this.levelData.startPos.col,
      this.levelData.startPos.row,
      this.levelData.width,
      this.levelData.height,
      this.gridSize,
      this.gameOffsetX,
      this.gameOffsetY
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
    this.drawPlayer();
    this.cameraFollow.centerOn(
      this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2,
      this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2
    );
    this.executeCommands(commands, 0);
  }

  private executeCommands(commands: Command[], index: number): void {
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
      this.drawPlayer();
      this.cameraFollow.centerOn(
        this.gameOffsetX + this.playerPos.col * this.gridSize + this.gridSize/2,
        this.gameOffsetY + this.playerPos.row * this.gridSize + this.gridSize/2
      );
      if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
        this.isVictory = true;
        this.isRunning = false;
        this.showVictoryMessage();
        return;
      }
      this.time.delayedCall(100, () => this.executeCommands(commands, index + 1));
    } else {
      this.isBroken = true;
      this.showGhostAt(collisionCell);
      const collisionX = this.gameOffsetX + collisionCell.col * this.gridSize;
      const collisionY = this.gameOffsetY + collisionCell.row * this.gridSize;
      const flash = this.add.rectangle(collisionX, collisionY, this.gridSize, this.gridSize, 0xff0000, 0.8).setOrigin(0, 0);
      this.time.delayedCall(300, () => flash.destroy());
      this.playerSprite.setFillStyle(0xff0000);
      this.showBrokenMessage();
      this.isRunning = false;
    }
  }

  private showGhostAt(cell: { col: number; row: number }): void {
    const x = this.gameOffsetX + cell.col * this.gridSize;
    const y = this.gameOffsetY + cell.row * this.gridSize;
    const ghost = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0x00ff00, 0.3).setOrigin(0, 0);
    this.time.delayedCall(500, () => ghost.destroy());
  }

  private showBrokenMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '💥 ROBOT BROKEN! 💥', {
      fontSize: '24px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
  }

  private showVictoryMessage(): void {
    const msg = this.add.text(this.cameras.main.width / 2, 100, '🏆 VICTORY! 🏆', {
      fontSize: '28px',
      color: '#ffcc00',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    msg.setScrollFactor(0);
    this.time.delayedCall(2000, () => msg.destroy());
    this.time.delayedCall(500, () => {
      alert('Victory!');
      this.commandPanel.destroy();
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
        const cell = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0).setStrokeStyle(1, 0xaaaaaa);
        this.gameContainer.add(cell);
      }
    }
  }

  private drawPlayer(): void {
    if (this.playerSprite) this.playerSprite.destroy();
    const x = this.playerPos.col * this.gridSize;
    const y = this.playerPos.row * this.gridSize;
    const color = this.isBroken ? 0xff0000 : (this.isVictory ? 0xffcc00 : 0x00ff00);
    this.playerSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, color).setOrigin(0, 0);
    this.gameContainer.add(this.playerSprite);
  }

  private drawCoin(): void {
    if (this.coinSprite) this.coinSprite.destroy();
    const x = this.coinPos.col * this.gridSize;
    const y = this.coinPos.row * this.gridSize;
    this.coinSprite = this.add.rectangle(x, y, this.gridSize, this.gridSize, 0xffcc00).setOrigin(0, 0);
    this.gameContainer.add(this.coinSprite);
  }

  private checkVictory(): void {
    if (this.playerPos.col === this.coinPos.col && this.playerPos.row === this.coinPos.row) {
      this.isVictory = true;
      this.showVictoryMessage();
    }
  }
}
