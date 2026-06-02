// src/modules/Player.ts
// ============================================================================
// КЛАСС ИГРОКА (ТАНК) – ПАТЧ 2.0
// ============================================================================
// Управляет состоянием танка: позиция, направление башни, направление корпуса,
// инвентарь, режимы (призрак, клей, клетка), клонирование, верховая езда.
// ============================================================================
// НОВОЕ В 2.0:
// - Раздельное управление башней (turretAngle) и корпусом (hullDirection)
// - Новые команды: TURN_LEFT/RIGHT (поворот башни без движения)
// - SYNC_BODY – синхронизация корпуса с башней
// - MOVE_FORWARD/MOVE_BACKWARD – движение вперёд/назад
// - Полная обратная совместимость через классический режим (controlMode)
// ============================================================================

import { Point, Inventory, Monster, Command, ControlMode } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { logger } from '../core/Logger';

export interface CloneInfo {
  id: string;
  position: Point;
  turretAngle: number;
  hullDirection: 'up' | 'down' | 'left' | 'right';
  inventory: Inventory;
  commands: Command[];
  currentCommandIndex: number;
}

export class Player {
  // ----- Основные параметры -----
  private position: Point;
  private turretAngle: number;          // 0, 90, 180, 270 градусов
  private hullDirection: 'up' | 'down' | 'left' | 'right';
  private inventory: Inventory;
  private isAlive: boolean = true;
  private isGhostMode: boolean = false;
  private levelBounds: { width: number; height: number };
  private tileMap: (col: number, row: number) => number;
  private controlMode: ControlMode = ControlMode.SEPARATE; // по умолчанию новое управление

  // ----- Продвинутые механики -----
  private clones: CloneInfo[] = [];
  private riddenMonster: Monster | null = null;

  // ----- Статусные эффекты -----
  private glued: boolean = false;
  private gluedTurns: number = 0;
  private trapped: boolean = false;
  private wingActiveTurns: number = 0;     // осталось ходов полёта

  // ----- Временные эффекты (замедление) -----
  private slowFactor: number = 1;           // множитель задержки (1 – норма, 2 – вдвое медленнее)

  constructor(
    startPos: Point,
    startDir: 'up' | 'down' | 'left' | 'right',
    levelWidth: number,
    levelHeight: number,
    tileGetter: (col: number, row: number) => number,
    controlMode: ControlMode = ControlMode.SEPARATE,
    startTurretAngle: number = 0
  ) {
    this.position = { ...startPos };
    this.hullDirection = startDir;
    this.turretAngle = startTurretAngle;
    this.controlMode = controlMode;
    this.levelBounds = { width: levelWidth, height: levelHeight };
    this.tileMap = tileGetter;
    this.resetInventory();
  }

  // --------------------------------------------------------------------------
  // ГЕТТЕРЫ
  // --------------------------------------------------------------------------
  public getPosition(): Point {
    return { ...this.position };
  }

  public getTurretAngle(): number {
    return this.turretAngle;
  }

  public getHullDirection(): 'up' | 'down' | 'left' | 'right' {
    return this.hullDirection;
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

  public getWingActiveTurns(): number {
    return this.wingActiveTurns;
  }

  public getSlowFactor(): number {
    return this.slowFactor;
  }

  // --------------------------------------------------------------------------
  // УПРАВЛЕНИЕ РЕЖИМАМИ
  // --------------------------------------------------------------------------
  public setGhostMode(enabled: boolean): void {
    this.isGhostMode = enabled;
    eventBus.emit('EXPLORATION_TOGGLED', { enabled, penaltyWarningShown: true });
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
  }

  // --------------------------------------------------------------------------
  // НОВЫЕ КОМАНДЫ ДВИЖЕНИЯ И ПОВОРОТА
  // --------------------------------------------------------------------------

  /**
   * Повернуть башню влево на 90° (без движения)
   */
  public turnTurretLeft(): void {
    this.turretAngle = (this.turretAngle - 90 + 360) % 360;
    eventBus.emit('TURRET_TURNED', { angle: this.turretAngle });
  }

  /**
   * Повернуть башню вправо на 90°
   */
  public turnTurretRight(): void {
    this.turretAngle = (this.turretAngle + 90) % 360;
    eventBus.emit('TURRET_TURNED', { angle: this.turretAngle });
  }

  /**
   * Развернуть башню на 180°
   */
  public turnTurretAround(): void {
    this.turretAngle = (this.turretAngle + 180) % 360;
    eventBus.emit('TURRET_TURNED', { angle: this.turretAngle });
  }

  /**
   * Установить абсолютный угол башни (0, 90, 180, 270)
   */
  public setTurretAngle(angle: number): void {
    const validAngles = [0, 90, 180, 270];
    if (validAngles.includes(angle)) {
      this.turretAngle = angle;
      eventBus.emit('TURRET_TURNED', { angle: this.turretAngle });
    }
  }

  /**
   * Синхронизировать корпус с башней (развернуть корпус в направлении башни)
   */
  public syncBodyWithTurret(): void {
    const newDir = this.angleToDirection(this.turretAngle);
    if (newDir) {
      this.hullDirection = newDir;
      eventBus.emit('HULL_TURNED', { direction: this.hullDirection });
    }
  }

  /**
   * Движение вперёд (по направлению башни)
   */
  public moveForward(): boolean {
    if (!this.canMove()) return false;
    const delta = this.angleToDelta(this.turretAngle);
    if (!delta) return false;
    const newPos = {
      col: this.position.col + delta.dx,
      row: this.position.row + delta.dy,
    };
    return this.tryMove(newPos);
  }

  /**
   * Движение назад (кормой)
   */
  public moveBackward(): boolean {
    if (!this.canMove()) return false;
    const delta = this.directionToDelta(this.hullDirection, -1);
    if (!delta) return false;
    const newPos = {
      col: this.position.col + delta.dx,
      row: this.position.row + delta.dy,
    };
    return this.tryMove(newPos);
  }

  // --------------------------------------------------------------------------
  // КЛАССИЧЕСКИЕ КОМАНДЫ (для обратной совместимости)
  // --------------------------------------------------------------------------
  /**
   * Старое движение вверх (сохраняется для ClassicMode, а также используется внутри)
   */
  public moveUp(): boolean {
    return this.moveClassic(0, -1);
  }

  public moveDown(): boolean {
    return this.moveClassic(0, 1);
  }

  public moveLeft(): boolean {
    return this.moveClassic(-1, 0);
  }

  public moveRight(): boolean {
    return this.moveClassic(1, 0);
  }

  private moveClassic(dx: number, dy: number): boolean {
    if (!this.canMove()) return false;
    const newPos = {
      col: this.position.col + dx,
      row: this.position.row + dy,
    };
    return this.tryMove(newPos);
  }

  /**
   * Общий метод для движения (проверка коллизий выполняется в movement.ts)
   * Здесь только физическое перемещение.
   */
  private tryMove(newPos: Point): boolean {
    if (!this.isWithinBounds(newPos)) return false;
    // Проверка проходимости будет в movement.ts, здесь просто перемещаем
    const oldPos = { ...this.position };
    this.position = newPos;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  private canMove(): boolean {
    if (!this.isAlive) return false;
    if (this.isTrapped()) return false;
    if (this.isGlued()) {
      this.decrementGlueTurn();
      if (this.isGlued()) return false;
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // ПРИНУДИТЕЛЬНАЯ ТЕЛЕПОРТАЦИЯ
  // --------------------------------------------------------------------------
  public teleport(point: Point): void {
    const oldPos = { ...this.position };
    this.position = { ...point };
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
  }

  // --------------------------------------------------------------------------
  // ОБРАБОТКА ЭФФЕКТОВ (конвейер, пружина, клей, клетка и т.д.)
  // --------------------------------------------------------------------------
  public applyConveyor(conveyorDir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.canMove()) return false;
    const delta = this.directionToDelta(conveyorDir, 1);
    if (!delta) return false;
    const newPos = {
      col: this.position.col + delta.dx,
      row: this.position.row + delta.dy,
    };
    return this.tryMove(newPos);
  }

  public applySpring(launchDir: 'up' | 'down' | 'left' | 'right', force: number = 3): boolean {
    if (!this.canMove()) return false;
    const delta = this.directionToDelta(launchDir, force);
    if (!delta) return false;
    const newPos = {
      col: this.position.col + delta.dx,
      row: this.position.row + delta.dy,
    };
    return this.tryMove(this.clampPoint(newPos));
  }

  private clampPoint(p: Point): Point {
    return {
      col: Math.max(0, Math.min(p.col, this.levelBounds.width - 1)),
      row: Math.max(0, Math.min(p.row, this.levelBounds.height - 1)),
    };
  }

  // --------------------------------------------------------------------------
  // УПРАВЛЕНИЕ ИНВЕНТАРЁМ (без изменений)
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

  public revive(startPos: Point, startDir: 'up' | 'down' | 'left' | 'right', startTurretAngle: number = 0): void {
    this.position = { ...startPos };
    this.hullDirection = startDir;
    this.turretAngle = startTurretAngle;
    this.isAlive = true;
    this.resetInventory();
    this.clones = [];
    this.riddenMonster = null;
    this.glued = false;
    this.gluedTurns = 0;
    this.trapped = false;
    this.wingActiveTurns = 0;
    this.slowFactor = 1;
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
  // КЛОНИРОВАНИЕ
  // --------------------------------------------------------------------------
  public createClone(cloneId: string, position: Point, commands: Command[]): void {
    const newClone: CloneInfo = {
      id: cloneId,
      position: { ...position },
      turretAngle: this.turretAngle,
      hullDirection: this.hullDirection,
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
    eventBus.emit('PLAYER_MOVED', { from: this.position, to: this.position });
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

  // Крылья
  public activateWing(turns: number = 2): void {
    this.wingActiveTurns = turns;
  }

  public decrementWingTurn(): void {
    if (this.wingActiveTurns > 0) {
      this.wingActiveTurns--;
      if (this.wingActiveTurns === 0) {
        eventBus.emit('WINGS_EXPIRED');
      }
    }
  }

  // Замедление
  public setSlowFactor(factor: number): void {
    this.slowFactor = factor;
    eventBus.emit('SLOW_FACTOR_CHANGED', { factor });
  }

  public resetSlowFactor(): void {
    this.slowFactor = 1;
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.levelBounds.width &&
           pos.row >= 0 && pos.row < this.levelBounds.height;
  }

  private angleToDelta(angle: number): { dx: number; dy: number } | null {
    switch (angle) {
      case 0:    return { dx: 0, dy: -1 };
      case 90:   return { dx: 1, dy: 0 };
      case 180:  return { dx: 0, dy: 1 };
      case 270:  return { dx: -1, dy: 0 };
      default:   return null;
    }
  }

  private directionToDelta(dir: 'up' | 'down' | 'left' | 'right', multiplier: number = 1): { dx: number; dy: number } | null {
    switch (dir) {
      case 'up':    return { dx: 0, dy: -1 * multiplier };
      case 'down':  return { dx: 0, dy: 1 * multiplier };
      case 'left':  return { dx: -1 * multiplier, dy: 0 };
      case 'right': return { dx: 1 * multiplier, dy: 0 };
      default:      return null;
    }
  }

  private angleToDirection(angle: number): 'up' | 'down' | 'left' | 'right' | null {
    switch (angle) {
      case 0:   return 'up';
      case 90:  return 'right';
      case 180: return 'down';
      case 270: return 'left';
      default:  return null;
    }
  }

  private emitInventoryChanged(): void {
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.getInventory() });
  }
}
