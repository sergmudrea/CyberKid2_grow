import { Scene } from 'phaser';

export class Preload extends Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    // Создаём текстовый логотип и прогресс-бар
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const logo = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const progressText = this.add.text(width / 2, height / 2, 'Loading 0%', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Имитируем загрузку (в реальном проекте здесь были бы ассеты)
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      if (progress >= 1) {
        clearInterval(interval);
        progressText.setText('Loading 100%');
        this.scene.start('MainMenu');
      } else {
        progressText.setText(`Loading ${Math.floor(progress * 100)}%`);
      }
    }, 50);
  }
}
