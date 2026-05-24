import { Scene } from 'phaser';
import { Point, Inventory } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

export class Player {
  private scene: Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private position: Point;
  private direction: 'up' | 'down' | 'left' | 'right';
  private inventory: Inventory;
  private isAlive: boolean = true;
  private isGhostMode: boolean = false;
  private gridSize: number;

  constructor(scene: Scene, startPos: Point, startDir: 'up' | 'down' | 'left' | 'right', gridSize: number) {
    this.scene = scene;
    this.position = { ...startPos };
    this.direction = startDir;
    this.gridSize = gridSize;
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    
    // Создаём спрайт игрока
    const texture = this.getDirectionTexture(startDir);
    this.sprite = scene.add.sprite(startPos.col * gridSize, startPos.row * gridSize, texture);
    this.sprite.setOrigin(0, 0);
    this.sprite.setDisplaySize(gridSize, gridSize);
  }

  private getDirectionTexture(dir: 'up' | 'down' | 'left' | 'right'): string {
    switch (dir) {
      case 'up': return 'player_up';
      case 'down': return 'player_down';
      case 'left': return 'player_left';
      case 'right': return 'player_right';
      default: return 'player';
    }
  }

  public getPosition(): Point {
    return { ...this.position };
  }

  public getDirection(): 'up' | 'down' | 'left' | 'right' {
    return this.direction;
  }

  public getInventory(): Inventory {
    return { ...this.inventory };
  }

  public isPlayerAlive(): boolean {
    return this.isAlive;
  }

  public isGhost(): boolean {
    return this.isGhostMode;
  }

  public setGhostMode(enabled: boolean): void {
    this.isGhostMode = enabled;
    if (enabled) {
      this.sprite.setAlpha(0.6);
    } else {
      this.sprite.setAlpha(1);
    }
    eventBus.emit('EXPLORATION_TOGGLED', { enabled, penaltyWarningShown: true });
  }

  public move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.isAlive) return false;
    
    const delta = this.directionToDelta(direction);
    const newPos = { col: this.position.col + delta.col, row: this.position.row + delta.row };
    
    this.direction = direction;
    this.updateSpriteTexture(direction);
    
    const x = newPos.col * this.gridSize;
    const y = newPos.row * this.gridSize;
    
    this.scene.tweens.add({
      targets: this.sprite,
      x: x,
      y: y,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        this.position = newPos;
        eventBus.emit('PLAYER_MOVED', { from: this.position, to: newPos });
      },
    });
    
    return true;
  }

  private updateSpriteTexture(direction: 'up' | 'down' | 'left' | 'right'): void {
    const texture = this.getDirectionTexture(direction);
    this.sprite.setTexture(texture);
  }

  public teleport(point: Point): void {
    const x = point.col * this.gridSize;
    const y = point.row * this.gridSize;
    this.sprite.setPosition(x, y);
    this.position = { ...point };
    eventBus.emit('PLAYER_MOVED', { from: this.position, to: this.position });
  }

  public kill(cause: string): void {
    if (this.isGhostMode) return;
    this.isAlive = false;
    // Эффект смерти
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.sprite.setAlpha(1);
      },
    });
    eventBus.emit('PLAYER_DIED', { cause });
  }

  public revive(startPos: Point, startDir: 'up' | 'down' | 'left' | 'right'): void {
    this.position = { ...startPos };
    this.direction = startDir;
    this.isAlive = true;
    this.isGhostMode = false;
    this.updateSpriteTexture(startDir);
    this.sprite.setPosition(startPos.col * this.gridSize, startPos.row * this.gridSize);
    this.sprite.setAlpha(1);
    this.resetInventory();
  }

  public resetInventory(): void {
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
  }

  public addKey(keyId: string): void {
    if (!this.inventory.keys.includes(keyId)) {
      this.inventory.keys.push(keyId);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    }
  }

  public useKey(keyId: string): boolean {
    const index = this.inventory.keys.indexOf(keyId);
    if (index !== -1) {
      this.inventory.keys.splice(index, 1);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      return true;
    }
    return false;
  }

  public addCorn(amount: number = 1): void {
    this.inventory.corn += amount;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
  }

  public useCorn(): boolean {
    if (this.inventory.corn > 0) {
      this.inventory.corn--;
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      return true;
    }
    return false;
  }

  public addCore(amount: number = 1): void {
    this.inventory.cores += amount;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
  }

  public useCore(): boolean {
    if (this.inventory.cores > 0) {
      this.inventory.cores--;
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      return true;
    }
    return false;
  }

  public addTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): void {
    switch (tool) {
      case 'drill': this.inventory.hasDrill = true; break;
      case 'hook': this.inventory.hasHook = true; break;
      case 'wing': this.inventory.hasWing = true; break;
      case 'bait': this.inventory.hasBait = true; break;
    }
    if (!this.inventory.tools.includes(tool)) this.inventory.tools.push(tool);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
  }

  public useTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): boolean {
    let has = false;
    switch (tool) {
      case 'drill': has = this.inventory.hasDrill; if (has) this.inventory.hasDrill = false; break;
      case 'hook': has = this.inventory.hasHook; if (has) this.inventory.hasHook = false; break;
      case 'wing': has = this.inventory.hasWing; if (has) this.inventory.hasWing = false; break;
      case 'bait': has = this.inventory.hasBait; if (has) this.inventory.hasBait = false; break;
    }
    if (has) {
      this.inventory.tools = this.inventory.tools.filter(t => t !== tool);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      return true;
    }
    return false;
  }

  private directionToDelta(dir: 'up' | 'down' | 'left' | 'right'): { col: number; row: number } {
    switch (dir) {
      case 'up': return { col: 0, row: -1 };
      case 'down': return { col: 0, row: 1 };
      case 'left': return { col: -1, row: 0 };
      case 'right': return { col: 1, row: 0 };
    }
  }
}
