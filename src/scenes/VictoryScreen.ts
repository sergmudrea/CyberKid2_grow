import { Scene } from 'phaser';
import { logger } from '../core/Logger';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';

export class VictoryScreen extends Scene {
  private levelId: string = '';
  private stars: number = 0;
  private stepsUsed: number = 0;
  private nextLevelId: string | null = null;

  constructor() {
    super('VictoryScreen');
  }

  init(data: { levelId: string; stars: number; stepsUsed: number }): void {
    this.levelId = data.levelId;
    this.stars = data.stars;
    this.stepsUsed = data.stepsUsed;
    this.nextLevelId = levelManager.getNextLevelId(this.levelId);
    logger.info('VictoryScreen', 'init', `Level ${this.levelId} completed with ${this.stars} stars, next level: ${this.nextLevelId || 'none'}`);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Конфетти
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const color = [0xff0000, 0x00ff00, 0x0000ff, 0xffcc00, 0xff00cc][Math.floor(Math.random() * 5)];
      const particle = this.add.rectangle(x, y, 4, 4, color);
      this.tweens.add({
        targets: particle,
        y: y + 200,
        alpha: 0,
        duration: 1000 + Math.random() * 1000,
        onComplete: () => particle.destroy(),
      });
    }

    // Заголовок
    const title = this.add.text(width / 2, 100, 'VICTORY!', {
      fontSize: '48px',
      color: '#ffcc00',
      stroke: '#ff6600',
      strokeThickness: 4,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Звёзды
    const starsY = 180;
    for (let i = 0; i < 3; i++) {
      const x = width / 2 - 80 + i * 80;
      const star = this.add.text(x, starsY, '★', {
        fontSize: '48px',
        color: i < this.stars ? '#ffcc00' : '#444444',
      }).setOrigin(0.5);
      
      if (i < this.stars) {
        this.tweens.add({
          targets: star,
          scale: 1.3,
          duration: 300,
          yoyo: true,
          repeat: 2,
        });
      }
    }

    // Статистика
    const stats = this.add.text(width / 2, 260, `Steps: ${this.stepsUsed}`, {
      fontSize: '20px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Кнопки
    const buttonY = 350;
    const spacing = 180;

    const nextButton = this.add.text(width / 2 - spacing / 2, buttonY, '▶ NEXT LEVEL', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: this.nextLevelId ? '#2a2a4a' : '#444444',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    
    if (this.nextLevelId) {
      nextButton.setInteractive({ useHandCursor: true });
      nextButton.on('pointerdown', () => {
        logger.info('VictoryScreen', 'nextButton', `Loading next level: ${this.nextLevelId}`);
        this.scene.start('GameScene', { levelId: this.nextLevelId });
      });
      nextButton.on('pointerover', () => nextButton.setColor('#00ffcc'));
      nextButton.on('pointerout', () => nextButton.setColor('#ffffff'));
    } else {
      nextButton.setColor('#888888');
    }

    const replayButton = this.add.text(width / 2 + spacing / 2, buttonY, '🔄 REPLAY', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    replayButton.on('pointerdown', () => {
      logger.info('VictoryScreen', 'replayButton', `Replaying level: ${this.levelId}`);
      this.scene.start('GameScene', { levelId: this.levelId });
    });
    replayButton.on('pointerover', () => replayButton.setColor('#00ffcc'));
    replayButton.on('pointerout', () => replayButton.setColor('#ffffff'));

    const menuButton = this.add.text(width / 2, buttonY + 70, '🏠 MAIN MENU', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menuButton.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });
    menuButton.on('pointerover', () => menuButton.setColor('#00ffcc'));
    menuButton.on('pointerout', () => menuButton.setColor('#ffffff'));
  }
}
