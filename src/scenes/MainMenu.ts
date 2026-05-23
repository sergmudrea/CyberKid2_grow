import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Заголовок
    this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Кнопка "Начать игру"
    const startButton = this.add.text(width / 2, height / 2, '▶ START', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      // Пока просто выведем в консоль, позже добавим переход на выбор мира
      startButton.on('pointerdown', () => {
      this.scene.start('GameScene', { levelId: 'test_001' });
      });
    });

    startButton.on('pointerover', () => startButton.setColor('#00ffcc'));
    startButton.on('pointerout', () => startButton.setColor('#ffffff'));
  }
}
