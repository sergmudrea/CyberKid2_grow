import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';

interface UniverseNode {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  isLocked: boolean;
  worlds: WorldNode[];
}

interface WorldNode {
  id: string;
  name: string;
  icon: string;
  isLocked: boolean;
  levelsCount: number;
  completedLevels: number;
  totalStars: number;
  maxStars: number;
}

export class WorldMap extends Scene {
  private universe: UniverseNode[] = [];
  private selectedUniverseId: string = 'main';
  private camera: Phaser.Cameras.Scene2D.Camera;
  private container: Phaser.GameObjects.Container;
  private worldButtons: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super('WorldMap');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Звёзды
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

    // Загружаем вселенную и миры
    this.loadUniverse();

    // Контейнер для миров
    this.container = this.add.container(0, 0);

    // Рисуем миры
    this.drawWorlds();

    // Настройка камеры для скролла
    this.camera = this.cameras.main;
    this.camera.setBounds(0, 0, width * 2, height);
    this.camera.setZoom(1);
    this.camera.centerOn(width / 2, height / 2);

    // Заголовок
    this.add.text(width / 2, 40, 'UNIVERSE', {
      fontSize: '32px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      stroke: '#ff6600',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Кнопка назад
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

  private loadUniverse(): void {
    const progress = progressManager.get();
    
    // Определяем миры для вселенной
    const worlds: WorldNode[] = [
      { id: 'meadow', name: 'Meadow', icon: '🌾', isLocked: false, levelsCount: 500, completedLevels: 0, totalStars: 0, maxStars: 1500 },
      { id: 'ocean', name: 'Ocean', icon: '🌊', isLocked: true, levelsCount: 500, completedLevels: 0, totalStars: 0, maxStars: 1500 },
      { id: 'clouds', name: 'Clouds', icon: '☁️', isLocked: true, levelsCount: 500, completedLevels: 0, totalStars: 0, maxStars: 1500 },
      { id: 'fairytale', name: 'Fairytale', icon: '🏰', isLocked: true, levelsCount: 500, completedLevels: 0, totalStars: 0, maxStars: 1500 },
      { id: 'volcano', name: 'Volcano', icon: '🌋', isLocked: true, levelsCount: 500, completedLevels: 0, totalStars: 0, maxStars: 1500 },
      { id: 'arcade', name: 'Arcade', icon: '🎮', isLocked: false, levelsCount: 999, completedLevels: 0, totalStars: 0, maxStars: 0 },
      { id: 'bonus', name: 'Bonus', icon: '⭐', isLocked: true, levelsCount: 3000, completedLevels: 0, totalStars: 0, maxStars: 9000 },
    ];

    // Обновляем прогресс миров
    for (const world of worlds) {
      const completedLevels = this.getCompletedLevelsCount(world.id);
      const totalStars = this.getTotalStars(world.id);
      world.completedLevels = completedLevels;
      world.totalStars = totalStars;
      
      // Разблокировка миров: Meadow открывает Ocean после 10 уровней
      if (world.id === 'ocean' && completedLevels >= 10) {
        world.isLocked = false;
        progressManager.unlockWorld('ocean');
      }
      if (world.id === 'clouds' && this.getCompletedLevelsCount('ocean') >= 50) {
        world.isLocked = false;
      }
      if (world.id === 'fairytale' && this.getCompletedLevelsCount('clouds') >= 50) {
        world.isLocked = false;
      }
      if (world.id === 'volcano' && this.getCompletedLevelsCount('fairytale') >= 50) {
        world.isLocked = false;
      }
      if (world.id === 'bonus' && this.getCompletedLevelsCount('volcano') >= 100) {
        world.isLocked = false;
      }
    }

    // Вселенная с мирами
    this.universe = [
      {
        id: 'main',
        name: 'CyberKid Universe',
        icon: '🌌',
        x: 400,
        y: 300,
        isLocked: false,
        worlds: worlds,
      },
    ];
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
    const universe = this.universe[0];
    const startX = 100;
    const startY = 150;
    const spacingX = 220;
    const spacingY = 180;
    const cols = 3;

    universe.worlds.forEach((world, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      const container = this.add.container(x, y);
      
      // Подложка
      const bgColor = world.isLocked ? 0x444444 : 0x2a2a4a;
      const bg = this.add.rectangle(0, 0, 180, 200, bgColor, 0.9);
      bg.setStrokeStyle(3, world.isLocked ? 0x888888 : 0x00ffcc);
      
      // Иконка
      const icon = this.add.text(0, -50, world.icon, { fontSize: '56px' }).setOrigin(0.5);
      
      // Название
      const name = this.add.text(0, 10, world.name, { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5);
      
      // Прогресс звёзд
      const starPercent = world.maxStars > 0 ? (world.totalStars / world.maxStars) * 100 : 0;
      const starCount = Math.floor(starPercent / 20);
      const starsText = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
      const stars = this.add.text(0, 40, starsText, { fontSize: '14px', color: '#ffcc00' }).setOrigin(0.5);
      
      // Количество пройденных уровней
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
          bg.setStrokeStyle(3, 0x00ffcc);
          name.setColor('#ffffff');
        });
      }
      
      this.worldButtons.set(world.id, container);
      this.container.add(container);
    });
  }
}
