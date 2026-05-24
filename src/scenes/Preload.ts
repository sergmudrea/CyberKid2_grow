import { Scene } from 'phaser';
import { levelManager } from '../managers/LevelManager';

export class Preload extends Scene {
  constructor() {
    super('Preload');
  }

  async create(): Promise<void> {
    console.log('Preload: initializing level manager...');
    await levelManager.initialize();
    console.log('Preload: levels loaded, starting MainMenu');
    this.scene.start('MainMenu');
  }
}
