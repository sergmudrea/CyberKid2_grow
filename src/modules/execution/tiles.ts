// src/modules/execution/tiles.ts
// ============================================================================
// ОБРАБОТЧИК СПЕЦИАЛЬНЫХ ТАЙЛОВ
// ============================================================================
// Этот модуль отвечает за все нестандартные взаимодействия с клетками уровня:
// - телепорты (мгновенное перемещение)
// - конвейеры (принудительное движение)
// - пружины (прыжок на несколько клеток)
// - чёрные ящики (преобразование предметов)
// - кнопки, рычаги, таймеры (активация мостов/дверей)
// - сенсоры, сортировщики
// - новые механики: клей (GLUE), клетка (CAGE), ловушка (TRAP)
// ============================================================================
// Все методы вызываются из MovementExecutor после перемещения игрока на соответствующий тайл.
// ============================================================================

import { TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError, getConveyorDirection, isWall, isHole } from './helpers';

export class TilesExecutor {
  private level: any;           // ссылка на объект уровня (с map, objects, width, height)
  private player: any;          // ссылка на игрока (для телепортации, установки glued/trapped)
  private inventory: Inventory; // инвентарь (для чёрного ящика, сортировщика)

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
  }

  // ==========================================================================
  // 1. ТЕЛЕПОРТЫ
  // ==========================================================================
  /**
   * Обрабатывает вход в телепорт (TELEPORT_IN).
   * Ищет соответствующий выход (TELEPORT_OUT) по ID телепорта.
   * Проверяет, что выход не заблокирован (стена, яма, кирпич).
   * При успехе перемещает игрока.
   */
  public processTeleport(entryPos: Point): boolean {
    const teleport = this.level.objects?.teleports?.find((t: any) =>
      t.entry.col === entryPos.col && t.entry.row === entryPos.row
    );
    if (!teleport) return false;

    const exitTile = this.level.map[teleport.exit.row]?.[teleport.exit.col];
    const isExitBlocked = isWall(exitTile) || isHole(exitTile) || exitTile === TileType.BRICK;
    if (isExitBlocked) {
      log('TilesExecutor', 'processTeleport', `Teleport exit blocked at (${teleport.exit.col},${teleport.exit.row})`);
      return false;
    }

    this.player.teleport(teleport.exit);
    logInfo('TilesExecutor', 'processTeleport', `Teleported from (${entryPos.col},${entryPos.row}) to (${teleport.exit.col},${teleport.exit.row})`);
    eventBus.emit('PLAYER_TELEPORT', { from: entryPos, to: teleport.exit });
    return true;
  }

  // ==========================================================================
  // 2. КОНВЕЙЕРЫ
  // ==========================================================================
  /**
   * Обрабатывает движение по конвейеру (CONVEYOR_*).
   * Вызывается после того, как игрок встал на конвейер.
   * Принудительно двигает игрока в направлении конвейера на одну клетку.
   * Рекурсивно применяется, если следующая клетка тоже конвейер.
   */
  public async processConveyor(pos: Point, command: any): Promise<boolean> {
    const tile = this.level.map[pos.row][pos.col];
    const direction = getConveyorDirection(tile);
    if (!direction) return false;

    // Преобразуем направление в дельту и команду движения
    let dx = 0, dy = 0;
    let cmd: any;
    switch (direction) {
      case 'up':    dy = -1; cmd = 'UP'; break;
      case 'down':  dy = 1;  cmd = 'DOWN'; break;
      case 'left':  dx = -1; cmd = 'LEFT'; break;
      case 'right': dx = 1;  cmd = 'RIGHT'; break;
    }

    const newPos = { col: pos.col + dx, row: pos.row + dy };
    if (newPos.col >= 0 && newPos.col < this.level.width &&
        newPos.row >= 0 && newPos.row < this.level.height) {
      const targetTile = this.level.map[newPos.row][newPos.col];
      if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
        this.player.move(cmd);   // физическое перемещение
        log('TilesExecutor', 'processConveyor', `Conveyor moved player to (${newPos.col},${newPos.row})`);
        // Рекурсивно обрабатываем следующий конвейер (если есть)
        const nextPos = this.player.getPosition();
        await this.processConveyor(nextPos, cmd);
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // 3. ПРУЖИНЫ
  // ==========================================================================
  /**
   * Обрабатывает пружину (SPRING).
   * Игрок подбрасывается на force клеток в направлении, указанном в данных пружины.
   * По умолчанию force = 3, направление — направление игрока (или заданное в объекте).
   */
  public async processSpring(pos: Point, direction: 'up' | 'down' | 'left' | 'right'): Promise<boolean> {
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.SPRING) return false;

    // Находим объект пружины (может содержать свою силу и направление)
    const spring = this.level.objects?.springs?.find((s: any) =>
      s.position.col === pos.col && s.position.row === pos.row
    );
    const force = spring?.force || 3;
    const launchDir = spring?.launchDirection || direction;

    let dx = 0, dy = 0;
    switch (launchDir) {
      case 'up':    dy = -force; break;
      case 'down':  dy = force;  break;
      case 'left':  dx = -force; break;
      case 'right': dx = force;  break;
    }

    const newPos = {
      col: Math.max(0, Math.min(pos.col + dx, this.level.width - 1)),
      row: Math.max(0, Math.min(pos.row + dy, this.level.height - 1)),
    };

    const targetTile = this.level.map[newPos.row][newPos.col];
    if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
      this.player.teleport(newPos);
      logInfo('TilesExecutor', 'processSpring', `Spring launched player to (${newPos.col},${newPos.row})`);
      eventBus.emit('PLAYER_MOVED', { from: pos, to: newPos });
      return true;
    }
    return false;
  }

  // ==========================================================================
  // 4. ЧЁРНЫЙ ЯЩИК
  // ==========================================================================
  /**
   * Обрабатывает вход на клетку чёрного ящика (BLACK_BOX).
   * Применяет преобразование к инвентарю согласно заданному mapping.
   * Само преобразование выполняется в BlackBoxProcessor.
   */
  public processBlackBox(pos: Point): void {
    const blackBox = this.level.objects?.blackBoxes?.find((b: any) =>
      b.position.col === pos.col && b.position.row === pos.row
    );
    if (!blackBox) return;

    logInfo('TilesExecutor', 'processBlackBox', `BlackBox triggered at (${pos.col},${pos.row}) mapping: ${blackBox.mapping}`);
    eventBus.emit('BLACK_BOX_ACTIVATED', { pos, mapping: blackBox.mapping });
    // Здесь должен быть вызов BlackBoxProcessor, но он уже используется в ExecutionEngine
    // (метод applySISO и т.д.). Оставляем заглушку для событий.
  }

  // ==========================================================================
  // 5. КНОПКИ, РЫЧАГИ, ТАЙМЕРЫ, СЕНСОРЫ, СОРТИРОВЩИКИ
  // ==========================================================================
  /**
   * Кнопка (BUTTON): при нажатии активирует связанные объекты (мосты, двери).
   */
  public processButton(pos: Point): void {
    const button = this.level.objects?.buttons?.find((b: any) =>
      b.position.col === pos.col && b.position.row === pos.row
    );
    if (!button) return;

    button.isPressed = true;
    logInfo('TilesExecutor', 'processButton', `Button pressed at (${pos.col},${pos.row})`);
    eventBus.emit('BUTTON_PRESSED', { pos, buttonId: button.id });

    // Активация связанных объектов
    if (button.linkedObjects) {
      for (const objId of button.linkedObjects) {
        const bridge = this.level.objects?.bridges?.find((b: any) => b.id === objId);
        if (bridge) {
          bridge.active = true;
          this.level.map[bridge.position.row][bridge.position.col] = TileType.BRIDGE_ACTIVE;
          eventBus.emit('BRIDGE_ACTIVATED', { bridgeId: objId });
        }
      }
    }
  }

  /**
   * Рычаг (LEVER): переключает состояние (вкл/выкл) и управляет связанными объектами.
   */
  public processLever(pos: Point): void {
    const lever = this.level.objects?.levers?.find((l: any) =>
      l.position.col === pos.col && l.position.row === pos.row
    );
    if (!lever) return;

    lever.state = !lever.state;
    logInfo('TilesExecutor', 'processLever', `Lever toggled at (${pos.col},${pos.row}) state: ${lever.state}`);
    eventBus.emit('LEVER_TOGGLED', { pos, leverId: lever.id, state: lever.state });

    if (lever.linkedObjects) {
      for (const objId of lever.linkedObjects) {
        const bridge = this.level.objects?.bridges?.find((b: any) => b.id === objId);
        if (bridge) {
          bridge.active = lever.state;
          this.level.map[bridge.position.row][bridge.position.col] = lever.state ? TileType.BRIDGE_ACTIVE : TileType.BRIDGE;
          eventBus.emit('BRIDGE_TOGGLED', { bridgeId: objId, state: lever.state });
        }
      }
    }
  }

  /**
   * Таймер (TIMER): запускает отсчёт, по истечении активирует связанные объекты.
   */
  public processTimer(pos: Point): void {
    const timer = this.level.objects?.timers?.find((t: any) =>
      t.position.col === pos.col && t.position.row === pos.row
    );
    if (!timer || timer.active) return;

    timer.active = true;
    timer.remaining = timer.delay;
    logInfo('TilesExecutor', 'processTimer', `Timer started at (${pos.col},${pos.row}) delay: ${timer.delay}ms`);
    eventBus.emit('TIMER_STARTED', { pos, timerId: timer.id, delay: timer.delay });

    setTimeout(() => {
      timer.active = false;
      logInfo('TilesExecutor', 'processTimer', `Timer finished at (${pos.col},${pos.row})`);
      eventBus.emit('TIMER_FINISHED', { pos, timerId: timer.id });
      if (timer.linkedObjects) {
        for (const objId of timer.linkedObjects) {
          const bridge = this.level.objects?.bridges?.find((b: any) => b.id === objId);
          if (bridge) {
            bridge.active = true;
            this.level.map[bridge.position.row][bridge.position.col] = TileType.BRIDGE_ACTIVE;
            eventBus.emit('BRIDGE_ACTIVATED', { bridgeId: objId });
          }
        }
      }
    }, timer.delay);
  }

  /**
   * Сенсор (SENSOR): проверяет, находится ли игрок в радиусе, и генерирует событие.
   */
  public processSensor(pos: Point): void {
    const sensor = this.level.objects?.sensors?.find((s: any) =>
      s.position.col === pos.col && s.position.row === pos.row
    );
    if (!sensor) return;

    const playerPos = this.player.getPosition();
    const distance = Math.abs(playerPos.col - pos.col) + Math.abs(playerPos.row - pos.row);
    if (distance <= sensor.range) {
      logInfo('TilesExecutor', 'processSensor', `Sensor triggered at (${pos.col},${pos.row}), player in range`);
      eventBus.emit('SENSOR_TRIGGERED', { pos, sensorId: sensor.id, playerPos });
    }
  }

  /**
   * Сортировщик (SORTER): сортирует ключи в инвентаре.
   */
  public processSorter(pos: Point): void {
    const sorter = this.level.objects?.sorters?.find((s: any) =>
      s.position.col === pos.col && s.position.row === pos.row
    );
    if (!sorter) return;

    logInfo('TilesExecutor', 'processSorter', `Sorter activated at (${pos.col},${pos.row}) order: ${sorter.order}`);
    eventBus.emit('SORTER_ACTIVATED', { pos, order: sorter.order });

    switch (sorter.order) {
      case 'asc':
        this.inventory.keys.sort();
        break;
      case 'desc':
        this.inventory.keys.sort().reverse();
        break;
      case 'fifo':
        // уже порядок добавления
        break;
      case 'lifo':
        this.inventory.keys.reverse();
        break;
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
  }

  // ==========================================================================
  // 6. НОВЫЕ МЕХАНИКИ: КЛЕЙ, КЛЕТКА, ЛОВУШКА
  // ==========================================================================
  /**
   * Клей (GLUE): приклеивает игрока на 3 хода.
   */
  public processGlue(pos: Point): void {
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.GLUE) return;
    
    if (!this.player.isGlued()) {
      this.player.setGlued(true, 3);
      logInfo('TilesExecutor', 'processGlue', `Player glued at (${pos.col},${pos.row}) for 3 turns`);
      eventBus.emit('PLAYER_GLUED', { pos, duration: 3 });
    }
  }

  /**
   * Клетка (CAGE): ловит игрока или монстра.
   * entity: 'player' или 'monster'
   * monsterId: нужен, если entity === 'monster'
   * Возвращает true, если удалось запереть.
   */
  public processCage(pos: Point, entity: 'player' | 'monster', monsterId?: string): boolean {
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.CAGE) return false;
    
    const cage = this.level.objects?.cages?.find((c: any) => c.position.col === pos.col && c.position.row === pos.row);
    if (!cage) return false;
    
    if (cage.isClosed) return false;
    
    if (entity === 'player') {
      cage.isClosed = true;
      cage.prisoner = 'player';
      this.player.setTrapped(true);
      logInfo('TilesExecutor', 'processCage', `Player trapped in cage at (${pos.col},${pos.row})`);
      eventBus.emit('PLAYER_TRAPPED', { pos });
      return true;
    } else if (entity === 'monster' && monsterId) {
      cage.isClosed = true;
      cage.prisoner = `monster_${monsterId}`;
      const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
      if (monster) {
        monster.isTrapped = true;
        logInfo('TilesExecutor', 'processCage', `Monster ${monsterId} trapped in cage at (${pos.col},${pos.row})`);
        eventBus.emit('MONSTER_TRAPPED', { monsterId, pos });
        return true;
      }
    }
    return false;
  }

  /**
   * Открытие клетки ключом (CAGE_KEY или обычным ключом).
   * Вызывается из InventoryExecutor при использовании ключа перед клеткой.
   */
  public openCage(pos: Point, inventory: Inventory): boolean {
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.CAGE) return false;
    
    const cage = this.level.objects?.cages?.find((c: any) => c.position.col === pos.col && c.position.row === pos.row);
    if (!cage || !cage.isClosed) return false;
    
    // Проверяем наличие ключа от клетки (или обычного ключа)
    if (inventory.keys.some(k => k === 'cage_key' || k === 'key')) {
      // Удаляем один ключ
      const keyIndex = inventory.keys.findIndex(k => k === 'cage_key' || k === 'key');
      if (keyIndex !== -1) inventory.keys.splice(keyIndex, 1);
      
      cage.isClosed = false;
      if (cage.prisoner === 'player') {
        this.player.setTrapped(false);
      } else if (cage.prisoner?.startsWith('monster_')) {
        const monsterId = cage.prisoner.replace('monster_', '');
        const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
        if (monster) monster.isTrapped = false;
      }
      cage.prisoner = null;
      logInfo('TilesExecutor', 'openCage', `Cage opened at (${pos.col},${pos.row})`);
      eventBus.emit('CAGE_OPENED', { pos });
      return true;
    }
    return false;
  }

  /**
   * Ловушка (TRAP): превращает монстра в драгоценность (GEM).
   * Вызывается из MonstersExecutor при движении монстра на клетку с ловушкой.
   * Возвращает true, если монстр уничтожен и на его месте появилась драгоценность.
   */
  public processTrap(pos: Point, monsterId: string): boolean {
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.TRAP) return false;
    
    const trap = this.level.objects?.traps?.find((t: any) => t.position.col === pos.col && t.position.row === pos.row);
    if (!trap || trap.used) return false;
    
    const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
    if (monster && !monster.isTamed && !monster.isRidden) {
      const monsterIndex = this.level.objects.monsters.findIndex((m: any) => m.id === monsterId);
      if (monsterIndex !== -1) {
        this.level.objects.monsters.splice(monsterIndex, 1);
        trap.used = true;
        this.level.map[pos.row][pos.col] = TileType.GEM;
        logInfo('TilesExecutor', 'processTrap', `Monster ${monsterId} turned into gem at (${pos.col},${pos.row})`);
        eventBus.emit('MONSTER_TRAPPED_TO_GEM', { monsterId, pos });
        return true;
      }
    }
    return false;
  }
}
