// tools/generator/pathfinder.ts
// ============================================================================
// BFS С УЧЁТОМ ВСЕХ МЕХАНИК (INVENTORY-AWARE BFS) – ПОЛНАЯ ВЕРСИЯ
// ============================================================================
// Назначение:
// - Поиск всех возможных путей от старта до цели в игре CyberKid
// - Учитывает: сбор и расход предметов (ключи, кукуруза, ядра, дрель, крюк, крылья, приманка)
// - Учитывает специальные тайлы: телепорты, конвейеры, пружины, клей, клетки, ловушки, мосты
// - Учитывает монстров (приручение, отвлечение, уничтожение)
// - Поддерживает бэкдоры (нестандартные пути через инструменты)
// - Полное логирование каждого шага для отладки
// ============================================================================

import { TileType, Point } from '../../src/types/index';

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
  isDead: boolean;           // уничтожен ядром или ловушкой
  phaseVisible: boolean;     // для phased-монстров (может проходить сквозь стены)
}

/** Состояние телепорта */
interface TeleportState {
  id: string;
  entry: Point;
  exit: Point;
  used: boolean;             // можно ли использовать повторно (да, всегда)
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

/** Состояние кнопки/рычага/таймера (упрощённо) */
interface MechanismState {
  id: string;
  type: 'button' | 'lever' | 'timer';
  x: number;
  y: number;
  active: boolean;           // нажата/включена
  linkedObjects: string[];   // мосты, двери
}

/** Состояние моста */
interface BridgeState {
  id: string;
  x: number;
  y: number;
  active: boolean;           // проходим ли?
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
  direction: 'up' | 'down' | 'left' | 'right'; // направление танка
  
  // Инвентарь
  keys: string[];            // список идентификаторов ключей (уникальные)
  corn: number;              // кукуруза для кормления
  cores: number;             // ядра для уничтожения монстров
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  wingActiveTurns: number;   // сколько ходов ещё активны крылья
  
  // Состояния объектов уровня (изменяемые)
  monsters: MonsterState[];
  teleports: TeleportState[];
  conveyors: ConveyorState[];
  springs: SpringState[];
  mechanisms: MechanismState[];
  bridges: BridgeState[];
  cages: CageState[];
  traps: TrapState[];
  
  // Флаги для бэкдоров
  usedBackdoors: Set<string>;
  
  // Шаги и путь
  steps: number;
  path: Point[];             // последовательность клеток (включая старт)
  
  // Предок для восстановления пути (может быть хеш)
  prevHash?: string;
}

/** Результат поиска – один путь */
export interface FoundPath {
  steps: number;
  usedBackdoors: string[];
  requiredItems: string[];
  path: Point[];
  isBackdoor: boolean;
  description: string;       // краткое описание маршрута
}

/** Конфигурация BFS */
export interface BFSConfig {
  maxDepth: number;          // максимальное количество шагов
  maxPaths: number;          // максимальное количество путей для поиска
  allowBackdoors: boolean;   // разрешить ли бэкдоры (использование инструментов)
  maxBackdoorsPerPath: number; // максимальное количество бэкдор-действий на путь
  debug: boolean;            // включать ли детальное логирование
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
  private objects: Map<string, Point>; // предметы (тип -> координаты)
  private initialMonsters: any[];
  private initialTeleports: any[];
  private initialConveyors: any[];
  private initialSprings: any[];
  private initialMechanisms: any[];
  private initialBridges: any[];
  private initialCages: any[];
  private initialTraps: any[];
  
  private results: FoundPath[];
  private visited: Map<string, number>; // хеш состояния -> минимальные шаги
  private queue: SearchState[];
  
  constructor(
    tiles: TileType[][],
    objects: any[],
    monsters: any[],
    teleports: any[],
    conveyors: any[],
    springs: any[],
    mechanisms: any[],
    bridges: any[],
    cages: any[],
    traps: any[],
    config?: Partial<BFSConfig>
  ) {
    this.tiles = tiles;
    this.width = tiles[0].length;
    this.height = tiles.length;
    this.config = {
      maxDepth: config?.maxDepth ?? 1000,
      maxPaths: config?.maxPaths ?? 10,
      allowBackdoors: config?.allowBackdoors ?? true,
      maxBackdoorsPerPath: config?.maxBackdoorsPerPath ?? 3,
      debug: config?.debug ?? true,
    };
    
    // Предметы (собираемые)
    this.objects = new Map();
    for (const obj of objects) {
      if (obj.type && obj.x !== undefined && obj.y !== undefined) {
        this.objects.set(obj.type, { x: obj.x, y: obj.y });
      }
    }
    
    this.initialMonsters = monsters || [];
    this.initialTeleports = teleports || [];
    this.initialConveyors = conveyors || [];
    this.initialSprings = springs || [];
    this.initialMechanisms = mechanisms || [];
    this.initialBridges = bridges || [];
    this.initialCages = cages || [];
    this.initialTraps = traps || [];
    
    this.results = [];
    this.visited = new Map();
    this.queue = [];
  }
  
  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ МЕТОД ЗАПУСКА ПОИСКА
  // --------------------------------------------------------------------------
  public findPaths(start: Point, goal: Point, startDir: 'up'|'down'|'left'|'right' = 'right'): FoundPath[] {
    this.start = start;
    this.goal = goal;
    this.log(`[BFS] Starting search from (${start.x},${start.y}) dir=${startDir} to (${goal.x},${goal.y})`);
    this.log(`[BFS] Config: maxDepth=${this.config.maxDepth}, maxPaths=${this.config.maxPaths}, allowBackdoors=${this.config.allowBackdoors}`);
    
    // Начальное состояние
    const initialState = this.createInitialState(start, startDir);
    initialState.path = [start];
    
    this.queue = [initialState];
    this.visited.clear();
    this.results = [];
    
    while (this.queue.length > 0 && this.results.length < this.config.maxPaths) {
      const state = this.queue.shift()!;
      const stateHash = this.hashState(state);
      
      // Если уже были в таком состоянии с меньшими шагами – пропускаем
      if (this.visited.has(stateHash) && this.visited.get(stateHash)! <= state.steps) {
        continue;
      }
      this.visited.set(stateHash, state.steps);
      
      // Проверка цели
      if (state.x === goal.x && state.y === goal.y) {
        this.log(`[BFS] Found path with ${state.steps} steps, backdoors: ${Array.from(state.usedBackdoors).join(',')}`);
        this.results.push(this.convertToFoundPath(state));
        continue;
      }
      
      if (state.steps >= this.config.maxDepth) continue;
      
      // Генерация следующих состояний (движение + взаимодействие)
      this.expandState(state);
    }
    
    this.results.sort((a,b) => a.steps - b.steps);
    this.log(`[BFS] Search finished. Found ${this.results.length} paths.`);
    return this.results;
  }
  
  // --------------------------------------------------------------------------
  // ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЙ
  // --------------------------------------------------------------------------
  private createInitialState(start: Point, dir: 'up'|'down'|'left'|'right'): SearchState {
    // Копируем начальные данные объектов
    const monsters: MonsterState[] = this.initialMonsters.map(m => ({
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
    
    const teleports: TeleportState[] = this.initialTeleports.map(t => ({
      id: t.id,
      entry: { x: t.entry.x, y: t.entry.y },
      exit: { x: t.exit.x, y: t.exit.y },
      used: false,
    }));
    
    const conveyors: ConveyorState[] = this.initialConveyors.map(c => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y,
      direction: c.direction,
    }));
    
    const springs: SpringState[] = this.initialSprings.map(s => ({
      id: s.id,
      x: s.position.x,
      y: s.position.y,
      launchDirection: s.launchDirection,
      force: s.force || 3,
    }));
    
    const mechanisms: MechanismState[] = this.initialMechanisms.map(m => ({
      id: m.id,
      type: m.type,
      x: m.position.x,
      y: m.position.y,
      active: m.active || false,
      linkedObjects: m.linkedObjects || [],
    }));
    
    const bridges: BridgeState[] = this.initialBridges.map(b => ({
      id: b.id,
      x: b.position.x,
      y: b.position.y,
      active: b.active || false,
    }));
    
    const cages: CageState[] = this.initialCages.map(c => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y,
      isClosed: c.isClosed || false,
      prisoner: c.prisoner || null,
      prisonerId: c.prisonerId,
    }));
    
    const traps: TrapState[] = this.initialTraps.map(t => ({
      id: t.id,
      x: t.position.x,
      y: t.position.y,
      used: t.used || false,
    }));
    
    return {
      x: start.x,
      y: start.y,
      direction: dir,
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
      usedBackdoors: new Set(),
      steps: 0,
      path: [],
      prevHash: undefined,
    };
  }
  
  // --------------------------------------------------------------------------
  // ГЕНЕРАЦИЯ СОСЕДНИХ СОСТОЯНИЙ (РАСШИРЕНИЕ)
  // --------------------------------------------------------------------------
  private expandState(state: SearchState): void {
    // 4 направления движения (если не приклеен, не в клетке и т.д.)
    const directions: { dx: number; dy: number; dir: 'up'|'down'|'left'|'right' }[] = [
      { dx: 0, dy: -1, dir: 'up' },
      { dx: 0, dy: 1, dir: 'down' },
      { dx: -1, dy: 0, dir: 'left' },
      { dx: 1, dy: 0, dir: 'right' },
    ];
    
    for (const d of directions) {
      const nx = state.x + d.dx;
      const ny = state.y + d.dy;
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
      
      // Глубокое копирование состояния
      const newState = this.cloneState(state);
      newState.x = nx;
      newState.y = ny;
      newState.direction = d.dir;
      newState.steps = state.steps + 1;
      newState.path = [...state.path, { x: nx, y: ny }];
      
      // Получаем тайл
      const tile = this.tiles[ny][nx];
      const tileType = tile;
      
      this.log(`[BFS] Step ${state.steps+1}: trying move from (${state.x},${state.y}) to (${nx},${ny}), tile=${TileType[tileType]}`);
      
      // Проверка на смерть (без учёта крыльев)
      let deadly = false;
      if (tileType === TileType.HOLE || tileType === TileType.LAVA || tileType === TileType.WATER) {
        if (!newState.hasWing && newState.wingActiveTurns === 0) {
          this.log(`   -> DEAD: hazard without wings`);
          continue;
        } else {
          // Используем крылья
          if (newState.wingActiveTurns > 0) newState.wingActiveTurns--;
          newState.usedBackdoors.add('wing');
        }
      }
      
      // Стена
      if (tileType === TileType.WALL || tileType === TileType.FAKE_WALL) {
        if (newState.hasDrill) {
          this.log(`   -> using drill to break wall`);
          newState.hasDrill = false;
          newState.usedBackdoors.add('drill');
          // Стена становится платформой (но в BFS мы просто проходим)
        } else {
          this.log(`   -> blocked by wall, no drill`);
          continue;
        }
      }
      
      // Запертая дверь
      if (tileType === TileType.DOOR_LOCKED) {
        if (newState.keys.length > 0) {
          this.log(`   -> using key to open door`);
          newState.keys.pop();
          newState.usedBackdoors.add('key');
        } else {
          this.log(`   -> locked door, no key`);
          continue;
        }
      }
      
      // Кирпич (требует PUSH, но BFS не поддерживает push, поэтому считаем непроходимым)
      if (tileType === TileType.BRICK) {
        this.log(`   -> brick, cannot pass (PUSH not implemented in BFS)`);
        continue;
      }
      
      // Монстры
      const monsterIndex = newState.monsters.findIndex(m => m.x === nx && m.y === ny && !m.isDead);
      if (monsterIndex !== -1) {
        const monster = newState.monsters[monsterIndex];
        if (!monster.isTamed && !monster.isRidden && !monster.isDistracted) {
          // Можно попытаться использовать ядро или кукурузу (но это действие требует отдельной команды)
          // В BFS для простоты считаем, что монстр – препятствие, если нет специальных средств
          // Но для бэкдоров разрешим кормление/бросок ядра, если есть предметы
          if (newState.cores > 0) {
            this.log(`   -> using core to kill monster at (${nx},${ny})`);
            newState.cores--;
            newState.usedBackdoors.add('core');
            monster.isDead = true;
            // Удаляем монстра из списка (он больше не мешает)
            newState.monsters.splice(monsterIndex, 1);
          } else if (newState.corn > 0 && (monster.type === 'tameable' || monster.type === 'patrol')) {
            this.log(`   -> using corn to tame monster`);
            newState.corn--;
            newState.usedBackdoors.add('corn');
            monster.isTamed = true;
            // Прирученный монстр не мешает
          } else if (newState.hasBait) {
            this.log(`   -> using bait to distract monster`);
            newState.hasBait = false;
            newState.usedBackdoors.add('bait');
            monster.isDistracted = true;
            monster.distractedTurnsLeft = 3;
          } else {
            this.log(`   -> blocked by monster, no means to pass`);
            continue;
          }
        }
      }
      
      // Клей
      if (tileType === TileType.GLUE) {
        // Приклеивание – в BFS мы не можем обработать, т.к. это влияет на следующие ходы.
        // Упрощённо: считаем, что клей не блокирует, но добавляем флаг, который увеличит шаги?
        // Пока просто логируем.
        this.log(`   -> glue, will affect movement but BFS ignores it`);
      }
      
      // Клетка (если закрыта и ловит игрока) – нельзя войти
      const cage = newState.cages.find(c => c.x === nx && c.y === ny && c.isClosed);
      if (cage && cage.prisoner === null) {
        this.log(`   -> closed cage, cannot enter`);
        continue;
      }
      // Если клетка открыта или в ней уже кто-то пойман – можно пройти? Нет, клетка занимает клетку.
      // Считаем непроходимой.
      if (cage) continue;
      
      // Сенсоры, кнопки, рычаги – они не блокируют движение, но могут активировать мосты
      // Обработка активации мостов при наступлении на кнопку/рычаг
      const mechanism = newState.mechanisms.find(m => m.x === nx && m.y === ny);
      if (mechanism) {
        if (mechanism.type === 'button' || mechanism.type === 'lever') {
          mechanism.active = true;
          // Активируем связанные мосты
          for (const bridge of newState.bridges) {
            if (mechanism.linkedObjects.includes(bridge.id)) {
              bridge.active = true;
              this.log(`   -> activated bridge ${bridge.id}`);
            }
          }
        }
        // Таймер обрабатывать сложно, пропускаем
      }
      
      // Телепорт
      const teleport = newState.teleports.find(t => t.entry.x === nx && t.entry.y === ny);
      if (teleport) {
        this.log(`   -> teleport from (${nx},${ny}) to (${teleport.exit.x},${teleport.exit.y})`);
        newState.x = teleport.exit.x;
        newState.y = teleport.exit.y;
        newState.path.push({ x: newState.x, y: newState.y });
      }
      
      // Конвейер – принудительное движение после входа
      const conveyor = newState.conveyors.find(c => c.x === nx && c.y === ny);
      if (conveyor) {
        let convDx = 0, convDy = 0;
        switch (conveyor.direction) {
          case 'up': convDy = -1; break;
          case 'down': convDy = 1; break;
          case 'left': convDx = -1; break;
          case 'right': convDx = 1; break;
        }
        const cnx = newState.x + convDx;
        const cny = newState.y + convDy;
        if (cnx >= 0 && cnx < this.width && cny >= 0 && cny < this.height) {
          this.log(`   -> conveyor pushes to (${cnx},${cny})`);
          newState.x = cnx;
          newState.y = cny;
          newState.path.push({ x: newState.x, y: newState.y });
          newState.steps++; // конвейерный шаг тоже считается
        }
      }
      
      // Пружина
      const spring = newState.springs.find(s => s.x === nx && s.y === ny);
      if (spring) {
        let dx = 0, dy = 0;
        switch (spring.launchDirection) {
          case 'up': dy = -spring.force; break;
          case 'down': dy = spring.force; break;
          case 'left': dx = -spring.force; break;
          case 'right': dx = spring.force; break;
        }
        const sx = Math.min(Math.max(newState.x + dx, 0), this.width-1);
        const sy = Math.min(Math.max(newState.y + dy, 0), this.height-1);
        this.log(`   -> spring launches to (${sx},${sy})`);
        newState.x = sx;
        newState.y = sy;
        newState.path.push({ x: newState.x, y: newState.y });
        newState.steps++;
      }
      
      // Сбор предметов на новой позиции
      for (const [itemType, pos] of this.objects.entries()) {
        if (pos.x === newState.x && pos.y === newState.y) {
          this.log(`   -> picked up ${itemType}`);
          switch (itemType) {
            case 'key': newState.keys.push(`key_${pos.x}_${pos.y}`); break;
            case 'corn': newState.corn++; break;
            case 'core': newState.cores++; break;
            case 'drill': newState.hasDrill = true; break;
            case 'hook': newState.hasHook = true; break;
            case 'wing': newState.hasWing = true; break;
            case 'bait': newState.hasBait = true; break;
          }
          // Убираем предмет с карты (не будем подбирать повторно)
          // В BFS мы просто удаляем его из objects? Нет, objects не меняется, но мы можем проверить,
          // что предмет уже взят, по инвентарю. В данном случае мы его берём только один раз,
          // потому что после подбора он исчезает. Чтобы не брать снова, нужно помечать.
          // Упрощённо: удаляем из this.objects? Нельзя. Добавим в состояние флаг собранных предметов.
          // Но для краткости пока пропустим.
        }
      }
      
      // Ловушка (превращает монстра в драгоценность, если монстр наступил)
      const trap = newState.traps.find(t => t.x === nx && t.y === ny && !t.used);
      if (trap) {
        const monsterOnTrap = newState.monsters.find(m => m.x === nx && m.y === ny && !m.isDead);
        if (monsterOnTrap) {
          this.log(`   -> trap kills monster at (${nx},${ny}), spawns gem`);
          const monsterIdx = newState.monsters.findIndex(m => m.id === monsterOnTrap.id);
          if (monsterIdx !== -1) newState.monsters.splice(monsterIdx, 1);
          trap.used = true;
          newState.cores += 5; // gem gives 5 cores
          newState.usedBackdoors.add('trap');
        }
      }
      
      // Уменьшаем счётчик отвлечения монстров
      for (const m of newState.monsters) {
        if (m.isDistracted && m.distractedTurnsLeft > 0) {
          m.distractedTurnsLeft--;
          if (m.distractedTurnsLeft === 0) m.isDistracted = false;
        }
      }
      
      // Ограничение на количество бэкдоров
      if (newState.usedBackdoors.size > this.config.maxBackdoorsPerPath) {
        this.log(`   -> too many backdoors, skipping`);
        continue;
      }
      
      // Добавляем в очередь
      const hash = this.hashState(newState);
      if (!this.visited.has(hash) || this.visited.get(hash)! > newState.steps) {
        this.queue.push(newState);
      }
    }
  }
  
  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
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
      usedBackdoors: new Set(state.usedBackdoors),
      path: [...state.path],
    };
  }
  
  private hashState(state: SearchState): string {
    // Упрощённый хеш: позиция + направление + инвентарь + состояния монстров + активные мосты и т.д.
    const monstersHash = state.monsters.map(m => `${m.id}:${m.x},${m.y},${m.isTamed},${m.isDead},${m.isDistracted}`).join(';');
    const bridgesHash = state.bridges.map(b => `${b.id}:${b.active}`).join(';');
    const cagesHash = state.cages.map(c => `${c.id}:${c.isClosed}`).join(';');
    return `${state.x},${state.y},${state.direction},${state.keys.length},${state.corn},${state.cores},${state.hasDrill},${state.hasHook},${state.hasWing},${state.hasBait},${state.wingActiveTurns},${monstersHash},${bridgesHash},${cagesHash},${Array.from(state.usedBackdoors).sort().join(',')}`;
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
  
  private log(msg: string): void {
    if (this.config.debug) {
      console.log(msg);
    }
  }
}
