import { Scene } from 'phaser';

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const title = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontSize: '64px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const startButton = this.add.text(width / 2, height / 2, '▶ START', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start('GameScene', { levelId: 'level_001' });
    });
  }
}
