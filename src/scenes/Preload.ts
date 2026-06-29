import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { logger } from '../core/Logger';
import { ASSET_DEFS, generateFallbackCanvas, TILE_SIZE } from '../managers/AssetManager';

export class Preload extends Scene {
  // Ключи, которые не удалось загрузить из public/ -> нужен рисованный фолбэк
  private failedKeys: Set<string> = new Set();

  constructor() {
    super('Preload');
  }

  async create(): Promise<void> {
    logger.info('Preload', 'create', 'Starting preload');

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2 + 5, '0%', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ffcc, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
      percentText.setText(`${Math.floor(value * 100)}%`);
    });

    // Если файл из public/ не найден — запоминаем ключ, позже нарисуем фолбэк.
    this.load.on('loaderror', (file: any) => {
      logger.warn('Preload', 'loaderror', `Asset not found in public/, will draw fallback: ${file.key}`);
      this.failedKeys.add(file.key);
    });

    // Пытаемся загрузить из public/ только те ассеты, у которых задан path.
    for (const def of ASSET_DEFS) {
      if (def.path) {
        this.load.image(def.key, def.path);
      }
    }

    this.load.on('complete', () => {
      this.ensureAllTextures();
      this.startGame();
    });

    this.load.start();
  }

  /**
   * Гарантирует, что текстура существует для КАЖДОГО ключа реестра:
   *  - если PNG из public/ загрузился — используем его;
   *  - если файла нет (loaderror) или у ассета нет path — рисуем лёгкий спрайт.
   * Каждый фолбэк рисуется на отдельном canvas (иначе Phaser покажет один кадр).
   */
  private ensureAllTextures(): void {
    let drawn = 0;
    for (const def of ASSET_DEFS) {
      const loaded = this.textures.exists(def.key) && !this.failedKeys.has(def.key);
      if (loaded) continue;

      // На всякий случай убираем «битую» текстуру с тем же ключом
      if (this.textures.exists(def.key)) {
        this.textures.remove(def.key);
      }
      const canvas = generateFallbackCanvas(def, TILE_SIZE);
      this.textures.addCanvas(def.key, canvas);
      drawn++;
    }
    logger.info('Preload', 'ensureAllTextures', `Drawn fallback sprites: ${drawn} / ${ASSET_DEFS.length}`);
  }

  private async startGame(): Promise<void> {
    logger.info('Preload', 'startGame', 'Initializing level manager');
    await levelManager.initialize();
    logger.info('Preload', 'startGame', 'Starting MainMenu');
    this.scene.start('MainMenu');
  }
}
