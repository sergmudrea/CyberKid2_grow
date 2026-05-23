import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    console.log('MainMenu create, width:', width, 'height:', height);

    // Заголовок с белым цветом и жёлтой обводкой
    const title = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'Arial',
      fontSize: '64px',
      color: '#ffffff',
      stroke: '#ffaa00',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Кнопка
    const startButton = this.add.text(width / 2, height / 2, '▶ START', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    });
    startButton.setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      console.log('Start clicked');
      this.scene.start('GameScene', { levelId: 'test_001' });
    });

    // Для отладки: добавим красный прямоугольник в левый верхний угол
    this.add.rectangle(50, 50, 100, 50, 0xff0000).setOrigin(0, 0);
  }
}
