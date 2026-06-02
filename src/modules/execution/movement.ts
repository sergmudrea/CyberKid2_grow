// src/modules/execution/movement.ts
// ============================================================================
// ОСНОВНАЯ ЛОГИКА ДВИЖЕНИЯ – С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
// ============================================================================
// - Каждый шаг логирует позицию, направление, текущий инвентарь
// - Логирует проверки на стены, ямы, монстров, двери, сбор предметов
// - Логирует вызовы конвейеров, пружин, телепортов и механизмов
// ============================================================================

import { Command, TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import {
  getFrontPosition,
  isWall,
  isHole,
  isDeadlyLiquid,
  isDoor,
  isTeleport,
  isConveyor,
  isSpring,
  isPickupItem,
  getConveyorDirection,
  log,
  logInfo,
  logError,
} from './helpers';
import { TilesExecutor } from './tiles';

export class MovementExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private lastDirection: 'up' | 'down' | 'left' | 'right';
  private explorationMode: boolean;
  private tilesExecutor: TilesExecutor;
  private backdoorUsed: boolean;
  private stepCount: number = 0; // для отладки

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.explorationMode = false;
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
    this.backdoorUsed = false;
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
  }

  public async execute(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void
  ): Promise<'ok' | 'dead'> {
    this.stepCount++;
    let dx = 0, dy = 0;
    let newDirection: 'up' | 'down' | 'left' | 'right' = 'right';

    switch (cmd) {
      case Command.UP:    dy = -1; newDirection = 'up'; break;
      case Command.DOWN:  dy = 1;  newDirection = 'down'; break;
      case Command.LEFT:  dx = -1; newDirection = 'left'; break;
      case Command.RIGHT: dx = 1;  newDirection = 'right'; break;
      default: return 'ok';
    }

    onDirectionChange(newDirection);
    this.lastDirection = newDirection;

    const oldPos = this.player.getPosition();
    const newPos = { col: oldPos.col + dx, row: oldPos.row + dy };

    // ЛОГ: начало шага
    console.log(`[MOVEMENT] Step ${this.stepCount}: Command=${cmd}, dir=${newDirection}`);
    console.log(`   oldPos=(${oldPos.col},${oldPos.row}) newPos=(${newPos.col},${newPos.row})`);
    console.log(`   Inventory: keys=${this.inventory.keys.length}, corn=${this.inventory.corn}, cores=${this.inventory.cores}, tools=${this.inventory.tools.join(',') || 'none'}`);

    // Границы
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      console.log(`   ❌ OUT OF BOUNDS -> DEAD`);
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    console.log(`   target tile code=${tile} (${TileType[tile] || 'UNKNOWN'})`);

    // Проверка на смерть
    if (!this.explorationMode) {
      if (isWall(tile)) {
        console.log(`   🧱 WALL -> DEAD`);
        return 'dead';
      }
      if (isHole(tile) && !this.inventory.hasWing) {
        console.log(`   🕳️ HOLE without wings -> DEAD`);
        return 'dead';
      }
      if (isDeadlyLiquid(tile) && !this.inventory.hasWing) {
        console.log(`   🌊 LAVA/WATER without wings -> DEAD`);
        return 'dead';
      }
    }

    // Дверь без ключа – смерть
    if (tile === TileType.DOOR_LOCKED) {
      if (this.inventory.keys.length === 0) {
        console.log(`   🔒 LOCKED DOOR and no key -> DEAD`);
        return 'dead';
      } else {
        // Есть ключ – открываем дверь, расходуем ключ
        this.level.map[newPos.row][newPos.col] = TileType.DOOR_UNLOCKED;
        const removedKey = this.inventory.keys.pop();
        this.backdoorUsed = true;
        console.log(`   🔑 DOOR unlocked using key ${removedKey}, remaining keys=${this.inventory.keys.length}`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        eventBus.emit('DOOR_UNLOCKED', { pos: newPos });
      }
    }

    // Кирпич – смерть
    if (tile === TileType.BRICK) {
      console.log(`   🧱 BRICK (needs PUSH) -> DEAD`);
      return 'dead';
    }

    // Монстры
    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      console.log(`   👾 MONSTER at (${newPos.col},${newPos.row}) -> DEAD`);
      return 'dead';
    }

    // Клей и клетка
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      console.log(`   🩹 GLUE - will glue player after move`);
      this.tilesExecutor.processGlue(newPos);
    }
    if (tile === TileType.CAGE) {
      console.log(`   🔐 CAGE - attempting to trap player`);
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) return 'dead';
    }

    // Выполняем движение
    this.player.move(cmd);
    const finalPos = this.player.getPosition();
    console.log(`   ✅ MOVED to (${finalPos.col},${finalPos.row})`);

    // СБОР ПРЕДМЕТОВ
    const finalTile = this.level.map[finalPos.row][finalPos.col];

    // 1. Проверка на предметы из массива items (уровни из JSON)
    const itemIndex = this.level.items?.findIndex((it: any) => it.pos.col === finalPos.col && it.pos.row === finalPos.row);
    if (itemIndex !== undefined && itemIndex !== -1) {
      const item = this.level.items[itemIndex];
      console.log(`   📦 Found item in items[]: id=${item.id}`);
      this.pickupItemFromItem(item.id, finalPos.col, finalPos.row);
      this.level.items.splice(itemIndex, 1);
    }
    // 2. Если на клетке есть предмет в виде тайла (из карты)
    else if (isPickupItem(finalTile)) {
      console.log(`   📦 Found pickup tile: ${TileType[finalTile]}`);
      this.pickupItem(finalPos.col, finalPos.row, finalTile);
    }

    // Телепорт
    if (finalTile === TileType.TELEPORT_IN) {
      console.log(`   🌀 TELEPORT_IN - activating teleport`);
      this.tilesExecutor.processTeleport(finalPos);
    }

    // Конвейер
    if (isConveyor(finalTile)) {
      console.log(`   ⬇️ CONVEYOR - will move extra step`);
      await this.tilesExecutor.processConveyor(finalPos, cmd);
    }

    // Пружина
    if (finalTile === TileType.SPRING) {
      console.log(`   🚀 SPRING - will launch player`);
      await this.tilesExecutor.processSpring(finalPos, newDirection);
    }

    // Чёрный ящик
    if (finalTile === TileType.BLACK_BOX) {
      console.log(`   📦 BLACK_BOX - processing transformation`);
      this.tilesExecutor.processBlackBox(finalPos);
    }

    // Механизмы
    if (finalTile === TileType.BUTTON) {
      console.log(`   🔘 BUTTON pressed`);
      this.tilesExecutor.processButton(finalPos);
    }
    if (finalTile === TileType.LEVER) {
      console.log(`   🎚️ LEVER toggled`);
      this.tilesExecutor.processLever(finalPos);
    }
    if (finalTile === TileType.TIMER) {
      console.log(`   ⏲️ TIMER started`);
      this.tilesExecutor.processTimer(finalPos);
    }
    if (finalTile === TileType.SENSOR) {
      console.log(`   📡 SENSOR triggered`);
      this.tilesExecutor.processSensor(finalPos);
    }
    if (finalTile === TileType.SORTER) {
      console.log(`   📊 SORTER activated`);
      this.tilesExecutor.processSorter(finalPos);
    }

    console.log(`   --- Step ${this.stepCount} completed successfully ---`);
    return 'ok';
  }

  private pickupItem(col: number, row: number, tile: TileType): void {
    console.log(`   🎒 PICKUP (tile): ${TileType[tile]} at (${col},${row})`);
    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${col}_${row}`);
        console.log(`      -> key added, total keys: ${this.inventory.keys.length}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        console.log(`      -> corn added, total: ${this.inventory.corn}`);
        break;
      case TileType.CORE:
        this.inventory.cores++;
        console.log(`      -> core added, total: ${this.inventory.cores}`);
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        console.log(`      -> drill added`);
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        console.log(`      -> hook added`);
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        console.log(`      -> wings added`);
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        console.log(`      -> bait added`);
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        console.log(`      -> cage key added`);
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        console.log(`      -> gem added (+5 cores), cores: ${this.inventory.cores}`);
        break;
      default:
        console.log(`      -> unknown pickup tile, ignored`);
        return;
    }
    this.level.map[row][col] = TileType.PLATFORM;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${col}_${row}` });
  }

  private pickupItemFromItem(itemId: string, col: number, row: number): void {
    console.log(`   🎒 PICKUP (item): ${itemId} at (${col},${row})`);
    switch (itemId) {
      case 'key1':
      case 'key':
        this.inventory.keys.push(`key_${col}_${row}`);
        console.log(`      -> key added, keys: ${this.inventory.keys.length}`);
        break;
      case 'corn1':
      case 'corn':
        this.inventory.corn++;
        console.log(`      -> corn added, total: ${this.inventory.corn}`);
        break;
      case 'core1':
      case 'core':
        this.inventory.cores++;
        console.log(`      -> core added, total: ${this.inventory.cores}`);
        break;
      case 'drill':
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        console.log(`      -> drill added`);
        break;
      case 'hook':
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        console.log(`      -> hook added`);
        break;
      case 'wing':
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        console.log(`      -> wings added`);
        break;
      case 'bait':
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        console.log(`      -> bait added`);
        break;
      case 'cage_key':
        this.inventory.keys.push('cage_key');
        console.log(`      -> cage key added`);
        break;
      case 'gem1':
      case 'gem':
        this.inventory.cores += 5;
        console.log(`      -> gem added (+5 cores), cores: ${this.inventory.cores}`);
        break;
      default:
        console.warn(`      -> unknown item id: ${itemId}, ignored`);
        return;
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${itemId}_${col}_${row}` });
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
