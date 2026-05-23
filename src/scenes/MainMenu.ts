import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    console.log('MainMenu create, width:', width, 'height:', height);

    const title = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    });
    title.setOrigin(0.5);

    const startButton = this.add.text(width / 2, height / 2, '▶ START', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    });
    startButton.setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      console.log('Start clicked');
      this.scene.start('GameScene', { levelId: 'test_001' });
    });
  }
}
