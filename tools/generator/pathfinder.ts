// tools/generator/pathfinder.ts
// ============================================================================
// BFS С УЧЁТОМ ВСЕХ МЕХАНИК (INVENTORY-AWARE BFS) – ПАТЧ 2.0
// ============================================================================
// Назначение:
// - Поиск всех возможных путей от старта до цели в игре CyberKid: Танкист
// - Учитывает раздельное управление башней и корпусом (углы, направление)
// - Учитывает сбор и расход предметов (ключи, кукуруза, ядра, дрель, крюк, крылья, приманка)
// - Учитывает специальные тайлы: телепорты, конвейеры, пружины, клей, клетки, ловушки, мосты
// - Учитывает монстров (приручение, отвлечение, уничтожение)
// - Учитывает магниты и замедляющие поля
// - Поддерживает бэкдоры (нестандартные пути через инструменты)
// - Полное логирование каждого шага для отладки
// ============================================================================

import { TileType, Point, Magnet, SlowField } from '../../src/types/index';

// ----------------------------------------------------------------------------
// ТИПЫ ДЛЯ BFS
// ----------------------------------------------------------------------------

/** Тип монстра (упрощённо) */
enum MonsterType {
  PATROL = 'patrol',
  CHASE = 'chase',
  TAMEABLE = 'tameable',
  PHASED = 'phased',
  ZOMBIE = 'zombie',
  BOSS = 'boss',
}

/** Состояние одного монстра */
interface MonsterState {
  id: string;
  type: MonsterType;
  x: number;
  y: number;
  isTamed: boolean;
  isRidden: boolean;
  isDistracted: boolean;
  distractedTurnsLeft: number;
  isDead: boolean;
  phaseVisible: boolean;
}

/** Состояние телепорта */
interface TeleportState {
  id: string;
  entry: Point;
  exit: Point;
}

/** Состояние конвейера */
interface ConveyorState {
  id: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

/** Состояние пружины */
interface SpringState {
  id: string;
  x: number;
  y: number;
  launchDirection: 'up' | 'down' | 'left' | 'right';
  force: number;
}

/** Состояние кнопки/рычага/таймера */
interface MechanismState {
  id: string;
  type: 'button' | 'lever' | 'timer';
  x: number;
  y: number;
  active: boolean;
  linkedObjects: string[];
}

/** Состояние моста */
interface BridgeState {
  id: string;
  x: number;
  y: number;
  active: boolean;
}

/** Состояние клетки (CAGE) */
interface CageState {
  id: string;
  x: number;
  y: number;
  isClosed: boolean;
  prisoner: 'player' | 'monster' | null;
  prisonerId?: string;
}

/** Состояние ловушки (TRAP) */
interface TrapState {
  id: string;
  x: number;
  y: number;
  used: boolean;
}

/** Главное состояние поиска */
export interface SearchState {
  x: number;
  y: number;
  turretAngle: number;           // 0,90,180,270 – направление башни
  hullDirection: 'up'|'down'|'left'|'right'; // направление корпуса (для движения назад)
  
  // Инвентарь
  keys: string[];
  corn: number;
  cores: number;
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  wingActiveTurns: number;
  
  // Состояния объектов уровня (изменяемые)
  monsters: MonsterState[];
  teleports: TeleportState[];
  conveyors: ConveyorState[];
  springs: SpringState[];
  mechanisms: MechanismState[];
  bridges: BridgeState[];
  cages: CageState[];
  traps: TrapState[];
  magnets: Magnet[];
  slowFields: SlowField[];
  
  // Временные эффекты
  slowFactor: number;            // множитель задержки (1 – нормально, 2 – вдвое медленнее)
  
  // Флаги для бэкдоров
  usedBackdoors: Set<string>;
  
  // Шаги и путь
  steps: number;
  path: Point[];
  
  // Предок для восстановления пути (хеш)
  prevHash?: string;
}

/** Результат поиска – один путь */
export interface FoundPath {
  steps: number;
  usedBackdoors: string[];
  requiredItems: string[];
  path: Point[];
  isBackdoor: boolean;
  description: string;
}

/** Конфигурация BFS */
export interface BFSConfig {
  maxDepth: number;
  maxPaths: number;
  allowBackdoors: boolean;
  maxBackdoorsPerPath: number;
  debug: boolean;
}

// ----------------------------------------------------------------------------
// ОСНОВНОЙ КЛАСС BFS
// ----------------------------------------------------------------------------

export class InventoryAwareBFS {
  private tiles: TileType[][];
  private width: number;
  private height: number;
  private start: Point;
  private goal: Point;
  private config: BFSConfig;
  
  private items: { type: string; x: number; y: number }[];
  private monsters: any[];
  private teleports: any[];
  private conveyors: any[];
  private springs: any[];
  private mechanisms: any[];
  private bridges: any[];
  private cages: any[];
  private traps: any[];
  private magnets: Magnet[];
  private slowFields: SlowField[];
  
  private results: FoundPath[];
  private visited: Map<string, number>;
  private queue: SearchState[];
  
  constructor(
    tiles: TileType[][],
    items: { type: string; x: number; y: number }[],
    monsters: any[],
    teleports: any[],
    conveyors: any[],
    springs: any[],
    mechanisms: any[],
    bridges: any[],
    cages: any[],
    traps: any[],
    magnets: Magnet[] = [],
    slowFields: SlowField[] = [],
    config?: Partial<BFSConfig>
  ) {
    this.tiles = tiles;
    this.width = tiles[0].length;
    this.height = tiles.length;
    this.items = items;
    this.monsters = monsters;
    this.teleports = teleports;
    this.conveyors = conveyors;
    this.springs = springs;
    this.mechanisms = mechanisms;
    this.bridges = bridges;
    this.cages = cages;
    this.traps = traps;
    this.magnets = magnets;
    this.slowFields = slowFields;
    this.config = {
      maxDepth: config?.maxDepth ?? 1000,
      maxPaths: config?.maxPaths ?? 10,
      allowBackdoors: config?.allowBackdoors ?? true,
      maxBackdoorsPerPath: config?.maxBackdoorsPerPath ?? 3,
      debug: config?.debug ?? true,
    };
    this.results = [];
    this.visited = new Map();
    this.queue = [];
  }
  
  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД ЗАПУСКА ПОИСКА
  // --------------------------------------------------------------------------
  public findPaths(start: Point, goal: Point, startHullDir: 'up'|'down'|'left'|'right' = 'right', startTurretAngle: number = 0): FoundPath[] {
    this.start = start;
    this.goal = goal;
    this.log(`[BFS] Starting search from (${start.x},${start.y}) hull=${startHullDir} turret=${startTurretAngle} to (${goal.x},${goal.y})`);
    this.log(`[BFS] Config: maxDepth=${this.config.maxDepth}, maxPaths=${this.config.maxPaths}, allowBackdoors=${this.config.allowBackdoors}`);
    
    const initialState = this.createInitialState(start, startHullDir, startTurretAngle);
    initialState.path = [start];
    
    this.queue = [initialState];
    this.visited.clear();
    this.results = [];
    
    while (this.queue.length > 0 && this.results.length < this.config.maxPaths) {
      const state = this.queue.shift()!;
      const stateHash = this.hashState(state);
      
      if (this.visited.has(stateHash) && this.visited.get(stateHash)! <= state.steps) {
        continue;
      }
      this.visited.set(stateHash, state.steps);
      
      if (state.x === goal.x && state.y === goal.y) {
        this.log(`[BFS] Found path with ${state.steps} steps, backdoors: ${Array.from(state.usedBackdoors).join(',')}`);
        this.results.push(this.convertToFoundPath(state));
        continue;
      }
      
      if (state.steps >= this.config.maxDepth) continue;
      
      this.expandState(state);
    }
    
    this.results.sort((a,b) => a.steps - b.steps);
    this.log(`[BFS] Search finished. Found ${this.results.length} paths.`);
    return this.results;
  }
  
  // --------------------------------------------------------------------------
  // ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЙ
  // --------------------------------------------------------------------------
  private createInitialState(start: Point, hullDir: 'up'|'down'|'left'|'right', turretAngle: number): SearchState {
    const monsters: MonsterState[] = this.monsters.map(m => ({
      id: m.id,
      type: m.type,
      x: m.position.x,
      y: m.position.y,
      isTamed: m.isTamed || false,
      isRidden: false,
      isDistracted: false,
      distractedTurnsLeft: 0,
      isDead: false,
      phaseVisible: true,
    }));
    
    const teleports: TeleportState[] = this.teleports.map(t => ({
      id: t.id,
      entry: { x: t.entry.x, y: t.entry.y },
      exit: { x: t.exit.x, y: t.exit.y },
    }));
    
    const conveyors: ConveyorState[] = this.conveyors.map(c => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y,
      direction: c.direction,
    }));
    
    const springs: SpringState[] = this.springs.map(s => ({
      id: s.id,
      x: s.position.x,
      y: s.position.y,
      launchDirection: s.launchDirection,
      force: s.force || 3,
    }));
    
    const mechanisms: MechanismState[] = this.mechanisms.map(m => ({
      id: m.id,
      type: m.type,
      x: m.position.x,
      y: m.position.y,
      active: m.active || false,
      linkedObjects: m.linkedObjects || [],
    }));
    
    const bridges: BridgeState[] = this.bridges.map(b => ({
      id: b.id,
      x: b.position.x,
      y: b.position.y,
      active: b.active || false,
    }));
    
    const cages: CageState[] = this.cages.map(c => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y,
      isClosed: c.isClosed || false,
      prisoner: c.prisoner || null,
      prisonerId: c.prisonerId,
    }));
    
    const traps: TrapState[] = this.traps.map(t => ({
      id: t.id,
      x: t.position.x,
      y: t.position.y,
      used: t.used || false,
    }));
    
    return {
      x: start.x,
      y: start.y,
      turretAngle,
      hullDirection: hullDir,
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      wingActiveTurns: 0,
      monsters,
      teleports,
      conveyors,
      springs,
      mechanisms,
      bridges,
      cages,
      traps,
      magnets: [...this.magnets],
      slowFields: [...this.slowFields],
      slowFactor: 1,
      usedBackdoors: new Set(),
      steps: 0,
      path: [],
      prevHash: undefined,
    };
  }
  
  // --------------------------------------------------------------------------
  // ГЕНЕРАЦИЯ СОСЕДНИХ СОСТОЯНИЙ
  // --------------------------------------------------------------------------
  private expandState(state: SearchState): void {
    // Возможные действия:
    // 1. Повороты башни (без движения)
    this.expandTurretActions(state);
    // 2. Движение вперёд/назад
    this.expandMovementActions(state);
    // 3. Взаимодействие с предметами (подбор)
    this.expandPickupActions(state);
    // 4. Использование инструментов (дрель, крюк) – их применяем при движении через препятствия
    // 5. Кормление/убийство монстров – при движении на клетку с монстром
  }
  
  private expandTurretActions(state: SearchState): void {
    // Поворот влево на 90°
    const newAngleLeft = (state.turretAngle - 90 + 360) % 360;
    const newStateLeft = this.cloneState(state);
    newStateLeft.turretAngle = newAngleLeft;
    newStateLeft.steps++;
    newStateLeft.path = [...state.path, { x: state.x, y: state.y }]; // позиция не меняется
    this.addState(newStateLeft);
    
    // Поворот вправо на 90°
    const newAngleRight = (state.turretAngle + 90) % 360;
    const newStateRight = this.cloneState(state);
    newStateRight.turretAngle = newAngleRight;
    newStateRight.steps++;
    newStateRight.path = [...state.path, { x: state.x, y: state.y }];
    this.addState(newStateRight);
    
    // Разворот на 180°
    const newAngleAround = (state.turretAngle + 180) % 360;
    const newStateAround = this.cloneState(state);
    newStateAround.turretAngle = newAngleAround;
    newStateAround.steps++;
    newStateAround.path = [...state.path, { x: state.x, y: state.y }];
    this.addState(newStateAround);
    
    // Синхронизация корпуса с башней
    if (state.turretAngle !== this.angleToDirection(state.turretAngle)) {
      const newStateSync = this.cloneState(state);
      newStateSync.hullDirection = this.angleToDirection(state.turretAngle);
      newStateSync.steps++;
      newStateSync.path = [...state.path, { x: state.x, y: state.y }];
      this.addState(newStateSync);
    }
  }
  
  private expandMovementActions(state: SearchState): void {
    // Движение вперёд (по направлению башни)
    const forwardDelta = this.angleToDelta(state.turretAngle);
    if (forwardDelta) {
      const nx = state.x + forwardDelta.dx;
      const ny = state.y + forwardDelta.dy;
      if (this.isValidMove(state, nx, ny)) {
        const newState = this.cloneState(state);
        newState.x = nx;
        newState.y = ny;
        newState.steps++;
        newState.path = [...state.path, { x: nx, y: ny }];
        // Обработка эффектов (клей, клетка, телепорт, конвейер, пружина, магнит, замедление)
        this.applyTileEffects(newState, nx, ny);
        this.addState(newState);
      }
    }
    
    // Движение назад (кормой)
    const backwardDelta = this.directionToDelta(state.hullDirection, -1);
    if (backwardDelta) {
      const nx = state.x + backwardDelta.dx;
      const ny = state.y + backwardDelta.dy;
      if (this.isValidMove(state, nx, ny)) {
        const newState = this.cloneState(state);
        newState.x = nx;
        newState.y = ny;
        newState.steps++;
        newState.path = [...state.path, { x: nx, y: ny }];
        this.applyTileEffects(newState, nx, ny);
        this.addState(newState);
      }
    }
  }
  
  private expandPickupActions(state: SearchState): void {
    // Подбор предметов на текущей клетке (уже делается в applyTileEffects, но можно и отдельно)
    // Здесь оставляем пустым – предметы подбираются при входе на клетку.
  }
  
  // --------------------------------------------------------------------------
  // ОБРАБОТКА ЭФФЕКТОВ НА КЛЕТКЕ
  // --------------------------------------------------------------------------
  private applyTileEffects(state: SearchState, x: number, y: number): void {
    const tile = this.tiles[y][x];
    // Подбор предметов
    const itemIndex = this.items.findIndex(it => it.x === x && it.y === y);
    if (itemIndex !== -1) {
      const item = this.items[itemIndex];
      this.log(`   -> picked up ${item.type} at (${x},${y})`);
      switch (item.type) {
        case 'key': state.keys.push(`key_${x}_${y}`); break;
        case 'corn': state.corn++; break;
        case 'core': state.cores++; break;
        case 'drill': state.hasDrill = true; break;
        case 'hook': state.hasHook = true; break;
        case 'wing': state.hasWing = true; break;
        case 'bait': state.hasBait = true; break;
      }
      // Отмечаем, что предмет взят (в реальном BFS его нужно удалить из мира)
      // Но для упрощения мы не меняем список items, однако состояние инвентаря изменилось.
    }
    
    // Клей – приклеивание (не обрабатываем в BFS, т.к. это влияет на будущие ходы, но для простоты игнорируем)
    if (tile === TileType.GLUE) {
      this.log(`   -> glue, but BFS ignores temporary effects`);
    }
    
    // Клетка (закрытая) – непроходима, уже проверено в isValidMove
    // Мосты – активность уже учтена при проверке проходимости
    
    // Телепорт
    const teleport = state.teleports.find(t => t.entry.x === x && t.entry.y === y);
    if (teleport) {
      this.log(`   -> teleport from (${x},${y}) to (${teleport.exit.x},${teleport.exit.y})`);
      state.x = teleport.exit.x;
      state.y = teleport.exit.y;
      state.path.push({ x: state.x, y: state.y });
    }
    
    // Конвейер – принудительное движение после входа
    const conveyor = state.conveyors.find(c => c.x === x && c.y === y);
    if (conveyor) {
      let dx = 0, dy = 0;
      switch (conveyor.direction) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }
      const cnx = state.x + dx;
      const cny = state.y + dy;
      if (cnx >= 0 && cnx < this.width && cny >= 0 && cny < this.height) {
        this.log(`   -> conveyor pushes to (${cnx},${cny})`);
        state.x = cnx;
        state.y = cny;
        state.path.push({ x: state.x, y: state.y });
        state.steps++; // конвейерный шаг считается
      }
    }
    
    // Пружина
    const spring = state.springs.find(s => s.x === x && s.y === y);
    if (spring) {
      let dx = 0, dy = 0;
      switch (spring.launchDirection) {
        case 'up': dy = -spring.force; break;
        case 'down': dy = spring.force; break;
        case 'left': dx = -spring.force; break;
        case 'right': dx = spring.force; break;
      }
      const sx = Math.min(Math.max(state.x + dx, 0), this.width-1);
      const sy = Math.min(Math.max(state.y + dy, 0), this.height-1);
      this.log(`   -> spring launches to (${sx},${sy})`);
      state.x = sx;
      state.y = sy;
      state.path.push({ x: state.x, y: state.y });
      state.steps++;
    }
    
    // Кнопка/рычаг – активация мостов
    const mechanism = state.mechanisms.find(m => m.x === x && m.y === y);
    if (mechanism && (mechanism.type === 'button' || mechanism.type === 'lever')) {
      mechanism.active = true;
      for (const bridge of state.bridges) {
        if (mechanism.linkedObjects.includes(bridge.id)) {
          bridge.active = true;
          this.log(`   -> activated bridge ${bridge.id}`);
        }
      }
    }
    
    // Магнит – притягивание в направлении башни
    const magnet = state.magnets.find(m => m.x === x && m.y === y);
    if (magnet) {
      // Притягиваем танк на одну клетку в сторону магнита, если башня смотрит на магнит
      const directionToMagnet = this.getDirectionTo(state.x, state.y, magnet.position.x, magnet.position.y);
      if (directionToMagnet === this.angleToDirection(state.turretAngle)) {
        const dx = Math.sign(magnet.position.x - state.x);
        const dy = Math.sign(magnet.position.y - state.y);
        const nx = state.x + dx;
        const ny = state.y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.isValidMove(state, nx, ny)) {
          this.log(`   -> magnet pulls to (${nx},${ny})`);
          state.x = nx;
          state.y = ny;
          state.path.push({ x: state.x, y: state.y });
          state.steps++;
        }
      }
    }
    
    // Замедляющее поле – увеличиваем множитель замедления (влияет на стоимость шагов, но не на количество)
    const slowField = state.slowFields.find(s => s.x === x && s.y === y);
    if (slowField) {
      state.slowFactor = slowField.factor;
      this.log(`   -> slow field, factor=${slowField.factor}`);
    }
  }
  
  // --------------------------------------------------------------------------
  // ПРОВЕРКА ВОЗМОЖНОСТИ ПЕРЕМЕЩЕНИЯ НА КЛЕТКУ
  // --------------------------------------------------------------------------
  private isValidMove(state: SearchState, nx: number, ny: number): boolean {
    if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false;
    const tile = this.tiles[ny][nx];
    
    // Стена – только если есть дрель
    if (tile === TileType.WALL) {
      if (state.hasDrill) {
        state.hasDrill = false;
        state.usedBackdoors.add('drill');
        this.log(`   -> using drill to break wall at (${nx},${ny})`);
        return true;
      }
      return false;
    }
    
    // Опасные тайлы (яма, лава, вода) – только если есть активные крылья
    if (tile === TileType.HOLE || tile === TileType.LAVA || tile === TileType.WATER) {
      if (state.wingActiveTurns > 0 || state.hasWing) {
        if (state.wingActiveTurns === 0 && state.hasWing) {
          state.wingActiveTurns = 2;
          state.hasWing = false;
          state.usedBackdoors.add('wing');
        } else if (state.wingActiveTurns > 0) {
          state.wingActiveTurns--;
        }
        this.log(`   -> flying over hazard at (${nx},${ny})`);
        return true;
      }
      return false;
    }
    
    // Запертая дверь – нужен ключ
    if (tile === TileType.DOOR_LOCKED) {
      if (state.keys.length > 0) {
        state.keys.pop();
        state.usedBackdoors.add('key');
        this.log(`   -> using key to open door at (${nx},${ny})`);
        return true;
      }
      return false;
    }
    
    // Клетка (закрытая) – нельзя войти
    const cage = state.cages.find(c => c.x === nx && c.y === ny && c.isClosed);
    if (cage) return false;
    
    // Мост – только если активен
    const bridge = state.bridges.find(b => b.x === nx && b.y === ny);
    if (bridge && !bridge.active) return false;
    
    // Монстр
    const monster = state.monsters.find(m => m.x === nx && m.y === ny && !m.isDead);
    if (monster) {
      if (monster.isTamed || monster.isRidden || monster.isDistracted) {
        // можно пройти
        return true;
      }
      // Попытка приручить/убить/отвлечь
      if (state.cores > 0) {
        state.cores--;
        monster.isDead = true;
        state.usedBackdoors.add('core');
        this.log(`   -> killing monster at (${nx},${ny}) with core`);
        return true;
      }
      if (state.corn > 0 && (monster.type === 'tameable' || monster.type === 'patrol')) {
        state.corn--;
        monster.isTamed = true;
        state.usedBackdoors.add('corn');
        this.log(`   -> taming monster at (${nx},${ny}) with corn`);
        return true;
      }
      if (state.hasBait) {
        state.hasBait = false;
        monster.isDistracted = true;
        monster.distractedTurnsLeft = 3;
        state.usedBackdoors.add('bait');
        this.log(`   -> distracting monster at (${nx},${ny}) with bait`);
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  private angleToDelta(angle: number): { dx: number; dy: number } | null {
    switch (angle) {
      case 0: return { dx: 0, dy: -1 };
      case 90: return { dx: 1, dy: 0 };
      case 180: return { dx: 0, dy: 1 };
      case 270: return { dx: -1, dy: 0 };
      default: return null;
    }
  }
  
  private directionToDelta(dir: 'up'|'down'|'left'|'right', sign: number = 1): { dx: number; dy: number } | null {
    switch (dir) {
      case 'up': return { dx: 0, dy: -1 * sign };
      case 'down': return { dx: 0, dy: 1 * sign };
      case 'left': return { dx: -1 * sign, dy: 0 };
      case 'right': return { dx: 1 * sign, dy: 0 };
      default: return null;
    }
  }
  
  private angleToDirection(angle: number): 'up'|'down'|'left'|'right' {
    switch (angle) {
      case 0: return 'up';
      case 90: return 'right';
      case 180: return 'down';
      case 270: return 'left';
      default: return 'right';
    }
  }
  
  private getDirectionTo(x1: number, y1: number, x2: number, y2: number): 'up'|'down'|'left'|'right'|null {
    if (x1 === x2 && y1 > y2) return 'up';
    if (x1 === x2 && y1 < y2) return 'down';
    if (y1 === y2 && x1 < x2) return 'right';
    if (y1 === y2 && x1 > x2) return 'left';
    return null;
  }
  
  private cloneState(state: SearchState): SearchState {
    return {
      ...state,
      keys: [...state.keys],
      monsters: state.monsters.map(m => ({ ...m })),
      teleports: state.teleports.map(t => ({ ...t })),
      conveyors: state.conveyors.map(c => ({ ...c })),
      springs: state.springs.map(s => ({ ...s })),
      mechanisms: state.mechanisms.map(m => ({ ...m })),
      bridges: state.bridges.map(b => ({ ...b })),
      cages: state.cages.map(c => ({ ...c })),
      traps: state.traps.map(t => ({ ...t })),
      magnets: state.magnets.map(m => ({ ...m })),
      slowFields: state.slowFields.map(s => ({ ...s })),
      usedBackdoors: new Set(state.usedBackdoors),
      path: [...state.path],
    };
  }
  
  private hashState(state: SearchState): string {
    const monstersHash = state.monsters.map(m => `${m.id}:${m.x},${m.y},${m.isTamed},${m.isDead},${m.isDistracted}`).join(';');
    const bridgesHash = state.bridges.map(b => `${b.id}:${b.active}`).join(';');
    const cagesHash = state.cages.map(c => `${c.id}:${c.isClosed}`).join(';');
    const magnetsHash = state.magnets.map(m => `${m.id}:${m.position.x},${m.position.y}`).join(';');
    const slowHash = state.slowFields.map(s => `${s.id}:${s.position.x},${s.position.y}`).join(';');
    return `${state.x},${state.y},${state.turretAngle},${state.hullDirection},${state.keys.length},${state.corn},${state.cores},${state.hasDrill},${state.hasHook},${state.hasWing},${state.hasBait},${state.wingActiveTurns},${monstersHash},${bridgesHash},${cagesHash},${magnetsHash},${slowHash},${Array.from(state.usedBackdoors).sort().join(',')}`;
  }
  
  private convertToFoundPath(state: SearchState): FoundPath {
    const requiredItems: string[] = [];
    if (state.keys.length > 0) requiredItems.push('key');
    if (state.corn > 0) requiredItems.push('corn');
    if (state.cores > 0) requiredItems.push('core');
    if (state.hasDrill) requiredItems.push('drill');
    if (state.hasHook) requiredItems.push('hook');
    if (state.hasWing) requiredItems.push('wing');
    if (state.hasBait) requiredItems.push('bait');
    
    return {
      steps: state.steps,
      usedBackdoors: Array.from(state.usedBackdoors),
      requiredItems,
      path: state.path,
      isBackdoor: state.usedBackdoors.size > 0,
      description: `Path with ${state.steps} steps, using ${Array.from(state.usedBackdoors).join(', ')}`,
    };
  }
  
  private addState(state: SearchState): void {
    const hash = this.hashState(state);
    if (!this.visited.has(hash) || this.visited.get(hash)! > state.steps) {
      this.queue.push(state);
    }
  }
  
  private log(msg: string): void {
    if (this.config.debug) {
      console.log(msg);
    }
  }
}
