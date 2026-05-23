import { Scene } from 'phaser';

export class Preload extends Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
