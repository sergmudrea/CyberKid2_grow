import { Scene } from 'phaser';

export class GameScene extends Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.text(width / 2, height / 3, 'GAME SCENE', {
      fontSize: '48px',
      color: '#00ffcc',
    }).setOrigin(0.5);

    const backButton = this.add.text(width / 2, height / 2, '← BACK TO MENU', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });
  }
}
