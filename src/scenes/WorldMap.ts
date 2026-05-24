import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { logger } from '../core/Logger';

interface WorldNode {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  isLocked: boolean;
  levelsCount: number;
  completedLevels: number;
  totalStars: number;
  maxStars: number;
}

export class WorldMap extends Scene {
  private worlds: WorldNode[] = [];
  private selectedWorldId: string = '';
  private camera: Phaser.Cameras.Scene2D.Camera;
  private worldContainer: Phaser.GameObjects.Container;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    for (let i = 0; i < 150; i++) {
      const star = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 1, 0xffffff, 0.4);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 3000,
        yoyo: true,
        repeat: -1,
      });
    }

    this.loadWorlds();
    this.worldContainer = this.add.container(0, 0);
    this.drawWorlds();

    this.camera = this.cameras.main;
    this.camera.setBounds(0, 0, width * 2, height);
    this.camera.setZoom(1);
    this.camera.centerOn(width / 2, height / 2);

    this.add.text(width / 2, 40, 'SELECT WORLD', {
      fontSize: '32px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      stroke: '#ff6600',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });
    backButton.setScrollFactor(0);
    backButton.setDepth(100);
  }

  private loadWorlds(): void {
    const worldsData = [
      { id: 'meadow', name: 'Meadow', icon: '🌾', x: 400, y: 300, levels: 20, isLocked: false },
      { id: 'ocean', name: 'Ocean', icon: '🌊', x: 700, y: 300, levels: 20, isLocked: true },
      { id: 'clouds', name: 'Clouds', icon: '☁️', x: 1000, y: 300, levels: 20, isLocked: true },
      { id: 'fairytale', name: 'Fairytale', icon: '🏰', x: 1300, y: 300, levels: 20, isLocked: true },
      { id: 'volcano', name: 'Volcano', icon: '🌋', x: 1600, y: 300, levels: 20, isLocked: true },
      { id: 'arcade', name: 'Arcade', icon: '🎮', x: 1900, y: 300, levels: 10, isLocked: false },
      { id: 'bonus', name: 'Bonus', icon: '⭐', x: 2200, y: 300, levels: 20, isLocked: true },
    ];

    const progress = progressManager.get();
    
    this.worlds = worldsData.map(world => {
      const completedLevels = this.getCompletedLevelsCount(world.id);
      const totalStars = this.getTotalStars(world.id);
      const maxStars = world.levels * 3;
      
      let isLocked = world.isLocked;
      if (world.id === 'ocean' && completedLevels >= 10) isLocked = false;
      if (world.id === 'clouds' && this.getCompletedLevelsCount('ocean') >= 10) isLocked = false;
      if (world.id === 'fairytale' && this.getCompletedLevelsCount('clouds') >= 10) isLocked = false;
      if (world.id === 'volcano' && this.getCompletedLevelsCount('fairytale') >= 10) isLocked = false;
      if (world.id === 'bonus' && this.getCompletedLevelsCount('volcano') >= 10) isLocked = false;
      if (world.id === 'arcade') isLocked = false;
      
      return {
        ...world,
        isLocked,
        completedLevels,
        totalStars,
        maxStars,
      };
    });
  }

  private getCompletedLevelsCount(worldId: string): number {
    const levelIds = levelManager.getLevelIdsForWorld(worldId);
    const progress = progressManager.get();
    let count = 0;
    for (const levelId of levelIds) {
      if (progress.levelStats[levelId]?.completed) count++;
    }
    return count;
  }

  private getTotalStars(worldId: string): number {
    const levelIds = levelManager.getLevelIdsForWorld(worldId);
    const progress = progressManager.get();
    let total = 0;
    for (const levelId of levelIds) {
      total += progress.levelStats[levelId]?.stars || 0;
    }
    return total;
  }

  private drawWorlds(): void {
    this.worlds.forEach(world => {
      const container = this.add.container(world.x, world.y);
      
      const bgColor = world.isLocked ? 0x444444 : 0x2a2a4a;
      const bg = this.add.rectangle(0, 0, 180, 200, bgColor, 0.9);
      bg.setStrokeStyle(2, world.isLocked ? 0x888888 : 0x00ffcc);
      
      const icon = this.add.text(0, -50, world.icon, { fontSize: '56px' }).setOrigin(0.5);
      const name = this.add.text(0, 10, world.name, { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5);
      
      const starPercent = world.maxStars > 0 ? (world.totalStars / world.maxStars) * 100 : 0;
      const starCount = Math.floor(starPercent / 20);
      const starsText = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
      const stars = this.add.text(0, 40, starsText, { fontSize: '14px', color: '#ffcc00' }).setOrigin(0.5);
      const levelsText = this.add.text(0, 65, `${world.completedLevels}/${world.levelsCount}`, { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0.5);
      
      container.add([bg, icon, name, stars, levelsText]);
      
      if (world.isLocked) {
        const lock = this.add.text(0, 0, '🔒', { fontSize: '32px' }).setOrigin(0.5);
        container.add(lock);
      } else {
        container.setInteractive(new Phaser.Geom.Rectangle(-90, -100, 180, 200), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => {
          this.scene.start('LevelSelect', { worldId: world.id });
        });
        container.on('pointerover', () => {
          bg.setStrokeStyle(3, 0xffaa00);
          name.setColor('#ffaa00');
        });
        container.on('pointerout', () => {
          bg.setStrokeStyle(2, 0x00ffcc);
          name.setColor('#ffffff');
        });
      }
      
      this.worldContainer.add(container);
    });
  }
}
