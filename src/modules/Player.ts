// src/modules/Player.ts
// ============================================================================
// КЛАСС ИГРОКА (ROBOT)
// ============================================================================
// Управляет состоянием робота: позиция, направление, инвентарь, режимы (призрак, клей, клетка),
// клонирование, верховая езда на монстре, а также приёмы движения с учётом препятствий.
// ============================================================================
// Все изменения публикуются через EventBus (PLAYER_MOVED, INVENTORY_CHANGED, PLAYER_DIED и т.д.)
// ============================================================================

import { Point, Inventory, Monster, Command } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { logger } from '../core/Logger';

// ----------------------------------------------------------------------------
// ИНТЕРФЕЙС ДЛЯ КЛОНОВ
// ----------------------------------------------------------------------------
export interface CloneInfo {
  id: string;
  position: Point;
  inventory: Inventory;
  commands: Command[];
  currentCommandIndex: number;
}

export class Player {
  // ----- Основные параметры -----
  private position: Point;                 // текущая клетка
  private direction: 'up' | 'down' | 'left' | 'right';
  private inventory: Inventory;
  private isAlive: boolean = true;
  private isGhostMode: boolean = false;    // режим исследования (неуязвим)
  private levelBounds: { width: number; height: number };
  private tileMap: (col: number, row: number) => number;  // функция получения типа тайла

  // ----- Продвинутые механики -----
  private clones: CloneInfo[] = [];         // активные клоны
  private riddenMonster: Monster | null = null; // монстр, на котором едет игрок

  // ----- Статусные эффекты -----
  private glued: boolean = false;           // приклеен ли?
  private gluedTurns: number = 0;           // сколько ходов осталось клеиться
  private trapped: boolean = false;         // заперт ли в клетке?

  // --------------------------------------------------------------------------
  // КОНСТРУКТОР
  // --------------------------------------------------------------------------
  constructor(
    startPos: Point,
    startDir: 'up' | 'down' | 'left' | 'right',
    levelWidth: number,
    levelHeight: number,
    tileGetter: (col: number, row: number) => number
  ) {
    this.position = { ...startPos };
    this.direction = startDir;
    this.levelBounds = { width: levelWidth, height: levelHeight };
    this.tileMap = tileGetter;
    this.resetInventory();
  }

  // --------------------------------------------------------------------------
  // ГЕТТЕРЫ (для внешних модулей)
  // --------------------------------------------------------------------------
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

  public getClones(): CloneInfo[] {
    return [...this.clones];
  }

  public getRiddenMonster(): Monster | null {
    return this.riddenMonster ? { ...this.riddenMonster } : null;
  }

  public isGlued(): boolean {
    return this.glued && this.gluedTurns > 0;
  }

  public isTrapped(): boolean {
    return this.trapped;
  }

  // --------------------------------------------------------------------------
  // УПРАВЛЕНИЕ РЕЖИМАМИ
  // --------------------------------------------------------------------------
  public setGhostMode(enabled: boolean): void {
    this.isGhostMode = enabled;
    eventBus.emit('EXPLORATION_TOGGLED', { enabled, penaltyWarningShown: true });
  }

  // --------------------------------------------------------------------------
  // ДВИЖЕНИЕ (основное)
  // --------------------------------------------------------------------------
  public move(command: Command): boolean {
    if (!this.isAlive) return false;
    if (this.isTrapped()) {
      logger.debug('Player', 'move', 'Trapped in cage – cannot move');
      return false;
    }
    if (this.isGlued()) {
      this.decrementGlueTurn();
      if (this.isGlued()) {
        logger.debug('Player', 'move', 'Glued – cannot move');
        return false;
      }
    }

    // Преобразуем команду в дельту
    let delta = { col: 0, row: 0 };
    let newDir = this.direction;
    switch (command) {
      case Command.UP:    delta = { col: 0, row: -1 }; newDir = 'up'; break;
      case Command.DOWN:  delta = { col: 0, row: 1 };  newDir = 'down'; break;
      case Command.LEFT:  delta = { col: -1, row: 0 }; newDir = 'left'; break;
      case Command.RIGHT: delta = { col: 1, row: 0 };  newDir = 'right'; break;
      default: return false;
    }

    const newPos = {
      col: this.position.col + delta.col,
      row: this.position.row + delta.row,
    };

    // Проверка границ
    if (!this.isWithinBounds(newPos)) return false;

    // Проверка возможности войти на клетку (стена, яма, лава и т.д.)
    const tile = this.tileMap(newPos.col, newPos.row);
    if (!this.canEnterTile(tile)) return false;

    // Выполняем движение
    const oldPos = { ...this.position };
    this.position = newPos;
    this.direction = newDir;

    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  // --------------------------------------------------------------------------
  // ПРИНУДИТЕЛЬНАЯ ТЕЛЕПОРТАЦИЯ (без проверок)
  // --------------------------------------------------------------------------
  public teleport(point: Point): void {
    const oldPos = { ...this.position };
    this.position = { ...point };
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
  }

  // --------------------------------------------------------------------------
  // ДВИЖЕНИЕ ОТ КОНВЕЙЕРА (вызывается из TilesExecutor)
  // --------------------------------------------------------------------------
  public applyConveyor(conveyorDir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.isAlive) return false;
    if (this.isTrapped()) return false;
    if (this.isGlued()) {
      this.decrementGlueTurn();
      if (this.isGlued()) return false;
    }

    const delta = this.dirToDelta(conveyorDir);
    const newPos = {
      col: this.position.col + delta.col,
      row: this.position.row + delta.row,
    };
    if (!this.isWithinBounds(newPos)) return false;
    const tile = this.tileMap(newPos.col, newPos.row);
    if (!this.canEnterTile(tile)) return false;

    const oldPos = { ...this.position };
    this.position = newPos;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  // --------------------------------------------------------------------------
  // ПРУЖИНА (вызывается из TilesExecutor)
  // --------------------------------------------------------------------------
  public applySpring(launchDir: 'up' | 'down' | 'left' | 'right', force: number = 3): boolean {
    if (!this.isAlive) return false;
    if (this.isTrapped()) return false;
    if (this.isGlued()) {
      this.decrementGlueTurn();
      if (this.isGlued()) return false;
    }

    let currentPos = { ...this.position };
    for (let i = 0; i < force; i++) {
      const delta = this.dirToDelta(launchDir);
      const nextPos = {
        col: currentPos.col + delta.col,
        row: currentPos.row + delta.row,
      };
      if (!this.isWithinBounds(nextPos)) return false;
      const tile = this.tileMap(nextPos.col, nextPos.row);
      if (!this.canEnterTile(tile)) return false;
      currentPos = nextPos;
    }
    const oldPos = { ...this.position };
    this.position = currentPos;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  // --------------------------------------------------------------------------
  // УПРАВЛЕНИЕ ИНВЕНТАРЁМ
  // --------------------------------------------------------------------------
  public addKey(keyId: string): void {
    if (!this.inventory.keys.includes(keyId)) {
      this.inventory.keys.push(keyId);
      this.emitInventoryChanged();
    }
  }

  public useKey(keyId: string): boolean {
    const idx = this.inventory.keys.indexOf(keyId);
    if (idx !== -1) {
      this.inventory.keys.splice(idx, 1);
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }

  public addCorn(amount: number = 1): void {
    this.inventory.corn += amount;
    this.emitInventoryChanged();
  }

  public useCorn(): boolean {
    if (this.inventory.corn > 0) {
      this.inventory.corn--;
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }

  public addCore(amount: number = 1): void {
    this.inventory.cores += amount;
    this.emitInventoryChanged();
  }

  public useCore(): boolean {
    if (this.inventory.cores > 0) {
      this.inventory.cores--;
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }

  public addTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): void {
    switch (tool) {
      case 'drill': this.inventory.hasDrill = true; break;
      case 'hook':  this.inventory.hasHook = true; break;
      case 'wing':  this.inventory.hasWing = true; break;
      case 'bait':  this.inventory.hasBait = true; break;
    }
    if (!this.inventory.tools.includes(tool)) this.inventory.tools.push(tool);
    this.emitInventoryChanged();
  }

  public useTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): boolean {
    let has = false;
    switch (tool) {
      case 'drill': has = this.inventory.hasDrill; if (has) this.inventory.hasDrill = false; break;
      case 'hook':  has = this.inventory.hasHook;  if (has) this.inventory.hasHook = false; break;
      case 'wing':  has = this.inventory.hasWing;  if (has) this.inventory.hasWing = false; break;
      case 'bait':  has = this.inventory.hasBait;  if (has) this.inventory.hasBait = false; break;
    }
    if (has) {
      this.inventory.tools = this.inventory.tools.filter(t => t !== tool);
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // СМЕРТЬ И ВОЗРОЖДЕНИЕ
  // --------------------------------------------------------------------------
  public kill(cause: string): void {
    if (this.isGhostMode) return;
    this.isAlive = false;
    eventBus.emit('PLAYER_DIED', { cause });
  }

  public revive(startPos: Point, startDir: 'up' | 'down' | 'left' | 'right'): void {
    this.position = { ...startPos };
    this.direction = startDir;
    this.isAlive = true;
    this.resetInventory();
    this.clones = [];
    this.riddenMonster = null;
    this.glued = false;
    this.gluedTurns = 0;
    this.trapped = false;
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
    this.emitInventoryChanged();
  }

  // --------------------------------------------------------------------------
  // КЛОНИРОВАНИЕ (параллелизм)
  // --------------------------------------------------------------------------
  public createClone(cloneId: string, position: Point, commands: Command[]): void {
    const newClone: CloneInfo = {
      id: cloneId,
      position: { ...position },
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      commands: [...commands],
      currentCommandIndex: 0,
    };
    this.clones.push(newClone);
    eventBus.emit('CLONE_CREATED', { cloneId, pos: position });
  }

  public removeClone(cloneId: string): void {
    this.clones = this.clones.filter(c => c.id !== cloneId);
  }

  public getClone(cloneId: string): CloneInfo | undefined {
    return this.clones.find(c => c.id === cloneId);
  }

  public updateClonePosition(cloneId: string, newPos: Point): void {
    const clone = this.getClone(cloneId);
    if (clone) clone.position = { ...newPos };
  }

  public joinClones(): void {
    for (const clone of this.clones) {
      // Суммируем инвентарь
      for (const key of clone.inventory.keys) {
        if (!this.inventory.keys.includes(key)) this.inventory.keys.push(key);
      }
      this.inventory.corn += clone.inventory.corn;
      this.inventory.cores += clone.inventory.cores;
      if (clone.inventory.hasDrill) this.inventory.hasDrill = true;
      if (clone.inventory.hasHook) this.inventory.hasHook = true;
      if (clone.inventory.hasWing) this.inventory.hasWing = true;
      if (clone.inventory.hasBait) this.inventory.hasBait = true;
      for (const tool of clone.inventory.tools) {
        if (!this.inventory.tools.includes(tool)) this.inventory.tools.push(tool);
      }
    }
    this.clones = [];
    this.emitInventoryChanged();
    eventBus.emit('PLAYER_MOVED', { from: this.position, to: this.position }); // Обновить UI
  }

  // --------------------------------------------------------------------------
  // ВЕРХОВАЯ ЕЗДА
  // --------------------------------------------------------------------------
  public rideMonster(monster: Monster): void {
    if (this.riddenMonster) this.dismountMonster();
    this.riddenMonster = { ...monster };
    this.riddenMonster.isRidden = true;
    this.position = { ...monster.position };
    eventBus.emit('MONSTER_TAMED', { monsterId: monster.id });
  }

  public dismountMonster(): void {
    if (this.riddenMonster) {
      this.riddenMonster.isRidden = false;
      this.riddenMonster = null;
    }
  }

  public isRiding(): boolean {
    return this.riddenMonster !== null;
  }

  // --------------------------------------------------------------------------
  // СТАТУСНЫЕ ЭФФЕКТЫ (клей, клетка)
  // --------------------------------------------------------------------------
  public setGlued(glued: boolean, turns: number = 3): void {
    this.glued = glued;
    this.gluedTurns = turns;
    if (glued) {
      logger.info('Player', 'setGlued', `Glued for ${turns} turns`);
      eventBus.emit('PLAYER_GLUED', { duration: turns });
    }
  }

  private decrementGlueTurn(): void {
    if (this.gluedTurns > 0) {
      this.gluedTurns--;
      if (this.gluedTurns === 0) {
        this.glued = false;
        logger.info('Player', 'decrementGlueTurn', 'No longer glued');
        eventBus.emit('PLAYER_UNGLUED');
      }
    }
  }

  public setTrapped(trapped: boolean): void {
    this.trapped = trapped;
    if (trapped) {
      logger.info('Player', 'setTrapped', 'Trapped in cage');
      eventBus.emit('PLAYER_TRAPPED');
    } else {
      logger.info('Player', 'setTrapped', 'Freed from cage');
      eventBus.emit('PLAYER_FREED');
    }
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ ПРИВАТНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  private dirToDelta(dir: 'up' | 'down' | 'left' | 'right'): { col: number; row: number } {
    switch (dir) {
      case 'up':    return { col: 0, row: -1 };
      case 'down':  return { col: 0, row: 1 };
      case 'left':  return { col: -1, row: 0 };
      case 'right': return { col: 1, row: 0 };
    }
  }

  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.levelBounds.width &&
           pos.row >= 0 && pos.row < this.levelBounds.height;
  }

  private canEnterTile(tile: number): boolean {
    // Стены (включая фальшивые) непроходимы без специальных средств
    if (tile === 1 || tile === 5) return false;   // WALL, FAKE_WALL (согласно TileType)
    // Яма, лава, вода – только с крыльями или в режиме призрака
    if (tile === 2 && !this.inventory.hasWing && !this.isGhostMode) return false;
    if ((tile === 32 || tile === 33) && !this.inventory.hasWing && !this.isGhostMode) return false;
    // Остальные тайлы (платформа, ключи, инструменты, цели, механизмы) – проходимы
    return true;
  }

  private emitInventoryChanged(): void {
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.getInventory() });
  }
}
