// src/modules/execution/movement.ts
// ============================================================================
// ОСНОВНАЯ ЛОГИКА ДВИЖЕНИЯ – С ПОДДЕРЖКОЙ СБОРА ПРЕДМЕТОВ ИЗ items
// ============================================================================
// - Добавлена проверка наличия предмета в `level.items` при входе на клетку
// - Подбор предмета происходит независимо от тайла карты, если на клетке есть item
// - После подбора предмет удаляется из массива items, клетка очищается
// - Исправлено зацикливание конвейеров (ограничение глубины уже есть)
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

    // Границы
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      log('MovementExecutor', 'execute', `Out of bounds at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    log('MovementExecutor', 'execute', `Moving from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row}), tile=${tile}`);

    // Проверка на смерть
    if (!this.explorationMode) {
      if (isWall(tile)) return 'dead';
      if (isHole(tile) && !this.inventory.hasWing) return 'dead';
      if (isDeadlyLiquid(tile) && !this.inventory.hasWing) return 'dead';
    }

    // Дверь без ключа – смерть
    if (tile === TileType.DOOR_LOCKED) {
      if (this.inventory.keys.length === 0) {
        log('MovementExecutor', 'execute', `Locked door at (${newPos.col},${newPos.row}) and no key`);
        return 'dead';
      } else {
        // Есть ключ – открываем дверь, расходуем ключ
        this.level.map[newPos.row][newPos.col] = TileType.DOOR_UNLOCKED;
        const removedKey = this.inventory.keys.pop();
        this.backdoorUsed = true;
        logInfo('MovementExecutor', 'execute', `Door unlocked at (${newPos.col},${newPos.row}) using key ${removedKey}`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        eventBus.emit('DOOR_UNLOCKED', { pos: newPos });
      }
    }

    // Кирпич – смерть (требуется PUSH)
    if (tile === TileType.BRICK) return 'dead';

    // Монстры
    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      log('MovementExecutor', 'execute', `Monster at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    // Клей и клетка (ловушка)
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      this.tilesExecutor.processGlue(newPos);
    }
    if (tile === TileType.CAGE) {
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) return 'dead';
    }

    // Выполняем движение
    this.player.move(cmd);

    // СБОР ПРЕДМЕТОВ (после перемещения)
    const finalPos = this.player.getPosition();
    const finalTile = this.level.map[finalPos.row][finalPos.col];

    // 1. Проверка на предметы из массива items (уровни, загруженные из JSON)
    const itemIndex = this.level.items?.findIndex((it: any) => it.pos.col === finalPos.col && it.pos.row === finalPos.row);
    if (itemIndex !== undefined && itemIndex !== -1) {
      const item = this.level.items[itemIndex];
      this.pickupItemFromItem(item.id, finalPos.col, finalPos.row);
      this.level.items.splice(itemIndex, 1); // удаляем предмет
    }
    // 2. Если на клетке есть предмет в виде тайла (изначальная карта)
    else if (isPickupItem(finalTile)) {
      this.pickupItem(finalPos.col, finalPos.row, finalTile);
    }

    // Телепорт (если наступили на вход)
    if (finalTile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(finalPos);
    }

    // Конвейер (с ограничением глубины)
    if (isConveyor(finalTile)) {
      await this.tilesExecutor.processConveyor(finalPos, cmd);
    }

    // Пружина
    if (finalTile === TileType.SPRING) {
      await this.tilesExecutor.processSpring(finalPos, newDirection);
    }

    // Чёрный ящик
    if (finalTile === TileType.BLACK_BOX) {
      this.tilesExecutor.processBlackBox(finalPos);
    }

    // Механизмы
    if (finalTile === TileType.BUTTON) this.tilesExecutor.processButton(finalPos);
    if (finalTile === TileType.LEVER) this.tilesExecutor.processLever(finalPos);
    if (finalTile === TileType.TIMER) this.tilesExecutor.processTimer(finalPos);
    if (finalTile === TileType.SENSOR) this.tilesExecutor.processSensor(finalPos);
    if (finalTile === TileType.SORTER) this.tilesExecutor.processSorter(finalPos);

    return 'ok';
  }

  // Подбор предмета, представленного в карте как тайл
  private pickupItem(col: number, row: number, tile: TileType): void {
    console.log(`[Movement] pickupItem (tile) at (${col},${row}) tile=${tile}`);
    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${col}_${row}`);
        console.log(`[Movement] Picked up key, keys: ${this.inventory.keys.length}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        console.log(`[Movement] Picked up corn, total: ${this.inventory.corn}`);
        break;
      case TileType.CORE:
        this.inventory.cores++;
        console.log(`[Movement] Picked up core, total: ${this.inventory.cores}`);
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        console.log(`[Movement] Picked up drill`);
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        console.log(`[Movement] Picked up hook`);
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        console.log(`[Movement] Picked up wing`);
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        console.log(`[Movement] Picked up bait`);
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        console.log(`[Movement] Picked up cage key`);
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        console.log(`[Movement] Picked up gem, cores: ${this.inventory.cores}`);
        break;
      default:
        return;
    }
    // Очищаем клетку от предмета
    this.level.map[row][col] = TileType.PLATFORM;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${col}_${row}` });
  }

  // Подбор предмета, заданного через поле items (для уровней из JSON)
  private pickupItemFromItem(itemId: string, col: number, row: number): void {
    console.log(`[Movement] pickupItemFromItem at (${col},${row}) itemId=${itemId}`);
    switch (itemId) {
      case 'key1':
      case 'key':
        this.inventory.keys.push(`key_${col}_${row}`);
        console.log(`[Movement] Picked up key from items, keys: ${this.inventory.keys.length}`);
        break;
      case 'corn1':
      case 'corn':
        this.inventory.corn++;
        console.log(`[Movement] Picked up corn from items, total: ${this.inventory.corn}`);
        break;
      case 'core1':
      case 'core':
        this.inventory.cores++;
        console.log(`[Movement] Picked up core from items, total: ${this.inventory.cores}`);
        break;
      case 'drill':
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        console.log(`[Movement] Picked up drill from items`);
        break;
      case 'hook':
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        console.log(`[Movement] Picked up hook from items`);
        break;
      case 'wing':
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        console.log(`[Movement] Picked up wing from items`);
        break;
      case 'bait':
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        console.log(`[Movement] Picked up bait from items`);
        break;
      case 'cage_key':
        this.inventory.keys.push('cage_key');
        console.log(`[Movement] Picked up cage key from items`);
        break;
      case 'gem1':
      case 'gem':
        this.inventory.cores += 5;
        console.log(`[Movement] Picked up gem from items, cores: ${this.inventory.cores}`);
        break;
      default:
        console.warn(`[Movement] Unknown item id: ${itemId}`);
        return;
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${itemId}_${col}_${row}` });
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
