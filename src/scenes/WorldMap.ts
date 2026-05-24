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
  private pathGraphics: Phaser.GameObjects.Graphics;
  private startX: number = 100;
  private startY: number = 200;
  private stepX: number = 280;
  private stepY: number = 120;
  private rows: number = 2;
  private cols: number = 4;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastScrollX: number = 0;
  private lastScrollY: number = 0;
  private autoScrollTimer: Phaser.Time.TimerEvent;

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

    this.loadWorlds();
    this.worldContainer = this.add.container(0, 0);
    this.pathGraphics = this.add.graphics();
    
    // Рисуем путь и миры
    this.drawPath();
    this.drawWorlds();

    // Настройка камеры и скролла
    this.camera = this.cameras.main;
    const mapWidth = this.cols * this.stepX + 200;
    const mapHeight = this.rows * this.stepY + 300;
    this.camera.setBounds(0, 0, mapWidth, mapHeight);
    this.camera.setZoom(1);
    this.camera.centerOn(width / 2, height / 2);
    
    // Сохраняем начальную позицию камеры для возврата
    this.lastScrollX = this.camera.scrollX;
    this.lastScrollY = this.camera.scrollY;

    // Обработка скролла мышью
    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      this.camera.scrollX += deltaX;
      this.camera.scrollY += deltaY;
      this.camera.clampBounds();
      this.lastScrollX = this.camera.scrollX;
      this.lastScrollY = this.camera.scrollY;
    });

    // Обработка перетаскивания мышью
    this.input.on('pointerdown', (pointer: any) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });
    this.input.on('pointermove', (pointer: any) => {
      if (this.isDragging) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;
        this.camera.scrollX = this.lastScrollX - dx;
        this.camera.scrollY = this.lastScrollY - dy;
        this.camera.clampBounds();
      }
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.lastScrollX = this.camera.scrollX;
      this.lastScrollY = this.camera.scrollY;
    });

    // Управление стрелками клавиатуры
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.camera.scrollX -= 50;
      this.camera.clampBounds();
      this.lastScrollX = this.camera.scrollX;
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.camera.scrollX += 50;
      this.camera.clampBounds();
      this.lastScrollX = this.camera.scrollX;
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.camera.scrollY -= 50;
      this.camera.clampBounds();
      this.lastScrollY = this.camera.scrollY;
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.camera.scrollY += 50;
      this.camera.clampBounds();
      this.lastScrollY = this.camera.scrollY;
    });

    // Автоматический возврат к центру через 5 секунд бездействия
    this.autoScrollTimer = this.time.addEvent({
      delay: 5000,
      callback: () => {
        this.camera.centerOn(this.cameras.main.width / 2, this.cameras.main.height / 2);
        this.lastScrollX = this.camera.scrollX;
        this.lastScrollY = this.camera.scrollY;
      },
      loop: false,
    });
    this.input.on('wheel', () => this.resetAutoScrollTimer());
    this.input.on('pointerdown', () => this.resetAutoScrollTimer());
    this.input.keyboard?.on('keydown', () => this.resetAutoScrollTimer());

    // Заголовок
    this.add.text(this.cameras.main.width / 2, 40, '🌌 CYBERKID UNIVERSE 🌌', {
      fontSize: '28px',
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

  private resetAutoScrollTimer(): void {
    this.autoScrollTimer.remove();
    this.autoScrollTimer = this.time.addEvent({
      delay: 5000,
      callback: () => {
        this.camera.centerOn(this.cameras.main.width / 2, this.cameras.main.height / 2);
        this.lastScrollX = this.camera.scrollX;
        this.lastScrollY = this.camera.scrollY;
      },
      loop: false,
    });
  }

  private loadWorlds(): void {
    const worldsData = [
      { id: 'meadow', name: 'Meadow', icon: '🌾', row: 0, col: 0, levels: 20, isLocked: false },
      { id: 'ocean', name: 'Ocean', icon: '🌊', row: 0, col: 1, levels: 20, isLocked: true },
      { id: 'clouds', name: 'Clouds', icon: '☁️', row: 0, col: 2, levels: 20, isLocked: true },
      { id: 'fairytale', name: 'Fairytale', icon: '🏰', row: 0, col: 3, levels: 20, isLocked: true },
      { id: 'volcano', name: 'Volcano', icon: '🌋', row: 1, col: 1, levels: 20, isLocked: true },
      { id: 'arcade', name: 'Arcade', icon: '🎮', row: 1, col: 2, levels: 10, isLocked: false },
      { id: 'bonus', name: 'Bonus', icon: '⭐', row: 1, col: 3, levels: 20, isLocked: true },
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
        x: this.startX + world.col * this.stepX,
        y: this.startY + world.row * this.stepY,
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

  private drawPath(): void {
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(4, 0x88aaff, 0.6);
    
    // Рисуем путь между мирами по порядку
    const order = ['meadow', 'ocean', 'clouds', 'fairytale', 'volcano', 'arcade', 'bonus'];
    for (let i = 0; i < order.length - 1; i++) {
      const from = this.worlds.find(w => w.id === order[i]);
      const to = this.worlds.find(w => w.id === order[i + 1]);
      if (from && to) {
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(from.x, from.y);
        this.pathGraphics.lineTo(to.x, to.y);
        this.pathGraphics.strokePath();
        
        // Рисуем стрелку направления
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowX = (from.x + to.x) / 2;
        const arrowY = (from.y + to.y) / 2;
        const arrowSize = 12;
        const arrowAngle1 = angle + Math.PI * 0.8;
        const arrowAngle2 = angle - Math.PI * 0.8;
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(arrowX, arrowY);
        this.pathGraphics.lineTo(arrowX + Math.cos(arrowAngle1) * arrowSize, arrowY + Math.sin(arrowAngle1) * arrowSize);
        this.pathGraphics.lineTo(arrowX + Math.cos(arrowAngle2) * arrowSize, arrowY + Math.sin(arrowAngle2) * arrowSize);
        this.pathGraphics.fillStyle(0x88aaff, 0.8);
        this.pathGraphics.fillPath();
      }
    }
  }

  private drawWorlds(): void {
    this.worlds.forEach(world => {
      const container = this.add.container(world.x, world.y);
      
      // Подложка с анимацией парения
      const bgColor = world.isLocked ? 0x444444 : 0x2a2a4a;
      const bg = this.add.rectangle(0, 0, 180, 200, bgColor, 0.9);
      bg.setStrokeStyle(3, world.isLocked ? 0x888888 : 0x00ffcc);
      
      // Анимация парения для всех миров
      this.tweens.add({
        targets: container,
        y: container.y - 5,
        duration: 1500 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      
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
          bg.setStrokeStyle(3, 0x00ffcc);
          name.setColor('#ffffff');
        });
      }
      
      this.worldContainer.add(container);
    });
  }
}
