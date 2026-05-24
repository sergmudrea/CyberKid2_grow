import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';
import { logger } from '../core/Logger';

export class Preload extends Scene {
  constructor() {
    super('Preload');
  }

  async create(): Promise<void> {
    logger.info('Preload', 'create', 'Starting preload');
    
    // Создаём прогресс-бар
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
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
    
    this.load.on('complete', () => {
      loadingText.setText('Complete!');
      logger.info('Preload', 'create', 'Assets loaded');
      this.startGame();
    });
    
    this.load.on('loaderror', (file: any) => {
      logger.warn('Preload', 'loaderror', `Failed to load: ${file.key}`);
    });
    
    // Загрузка тайлов
    this.load.image('tile_platform', '/assets/tiles/platform.png');
    this.load.image('tile_wall', '/assets/tiles/wall.png');
    this.load.image('tile_hole', '/assets/tiles/hole.png');
    this.load.image('tile_coin', '/assets/tiles/coin.png');
    this.load.image('tile_start', '/assets/tiles/start.png');
    
    // Загрузка спрайтов игрока
    this.load.image('player_up', '/assets/player/player_up.png');
    this.load.image('player_down', '/assets/player/player_down.png');
    this.load.image('player_left', '/assets/player/player_left.png');
    this.load.image('player_right', '/assets/player/player_right.png');
    this.load.image('player', '/assets/player/player.png');
    
    // Загрузка монстров
    this.load.image('monster_patrol', '/assets/monsters/monster_patrol.png');
    this.load.image('monster_chase', '/assets/monsters/monster_chase.png');
    this.load.image('monster_tameable', '/assets/monsters/monster_tameable.png');
    
    // Загрузка UI
    this.load.image('ui_button_run', '/assets/ui/button_run.png');
    this.load.image('ui_button_clear', '/assets/ui/button_clear.png');
    this.load.image('ui_button_save', '/assets/ui/button_save.png');
    this.load.image('ui_button_load', '/assets/ui/button_load.png');
    
    // Загрузка эффектов
    this.load.image('effect_teleport', '/assets/effects/teleport.png');
    this.load.image('effect_death', '/assets/effects/death.png');
    this.load.image('effect_victory', '/assets/effects/victory.png');
    
    // Начало загрузки
    this.load.start();
  }
  
  private async startGame(): Promise<void> {
    logger.info('Preload', 'startGame', 'Initializing level manager');
    await levelManager.initialize();
    logger.info('Preload', 'startGame', 'Starting MainMenu');
    this.scene.start('MainMenu');
  }
}
