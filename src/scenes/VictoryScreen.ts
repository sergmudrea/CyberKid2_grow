import { Scene } from 'phaser';
import { logger } from '../core/Logger';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';
import { Pathfinder } from '../modules/Pathfinder';
import { ControlMode } from '../types/index';

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

  async create(): Promise<void> {
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
    const title = this.add.text(width / 2, 80, 'VICTORY!', {
      fontSize: '48px',
      color: '#ffcc00',
      stroke: '#ff6600',
      strokeThickness: 4,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title,
      scale: 1.1,
      duration: 600,
      yoyo: true,
      repeat: 2,
    });

    // Звёзды с анимацией pulse
    const starsY = 170;
    for (let i = 0; i < 3; i++) {
      const x = width / 2 - 80 + i * 80;
      const earned = i < this.stars;
      const star = this.add.text(x, starsY, '★', {
        fontSize: '52px',
        color: earned ? '#ffcc00' : '#444444',
      }).setOrigin(0.5);

      if (earned) {
        this.time.delayedCall(i * 200, () => {
          this.tweens.add({
            targets: star,
            scale: 1.4,
            duration: 250,
            yoyo: true,
            repeat: 1,
            ease: 'Back.easeOut',
          });
        });
      }
    }

    // Эффективность
    let optimalSteps: number | null = null;
    try {
      const level = await levelManager.loadLevel(this.levelId);
      if (level) {
        if (level.optimalSteps) {
          optimalSteps = level.optimalSteps;
        } else {
          const pf = new Pathfinder(level);
          const controlMode = level.controlMode || ControlMode.SEPARATE;
          const solution = pf.findCommandSolution(controlMode);
          if (solution) optimalSteps = solution.length;
        }
      }
    } catch (e) {
      logger.warn('VictoryScreen', 'create', 'Could not compute optimal steps');
    }

    let statsText = `Шагов: ${this.stepsUsed}`;
    if (optimalSteps !== null && optimalSteps > 0) {
      const efficiency = Math.round((optimalSteps / Math.max(this.stepsUsed, 1)) * 100);
      statsText += `  |  Оптимум: ${optimalSteps}  |  Эффективность: ${efficiency}%`;
    }

    this.add.text(width / 2, 255, statsText, {
      fontSize: '16px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Уведомление о разблокировке мира (если только что разблокировали)
    const progress = progressManager.get();
    const justUnlocked = this.checkNewWorldUnlocked(progress.unlockedWorlds);
    if (justUnlocked) {
      const unlockBanner = this.add.text(width / 2, 295, `🌍 Новый мир разблокирован: ${justUnlocked}!`, {
        fontSize: '16px',
        color: '#00ffcc',
        backgroundColor: '#000000aa',
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5);
      this.tweens.add({
        targets: unlockBanner,
        alpha: 0.3,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }

    // Кнопки
    const buttonY = 355;
    const spacing = 190;

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

  // Простая эвристика: если в прогрессе есть миры кроме meadow — показываем последний
  private checkNewWorldUnlocked(unlockedWorlds: string[]): string | null {
    const known = ['meadow'];
    const extras = unlockedWorlds.filter(w => !known.includes(w));
    if (extras.length > 0) return extras[extras.length - 1];
    return null;
  }
}
