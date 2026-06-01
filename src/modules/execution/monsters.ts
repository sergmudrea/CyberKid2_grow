// src/modules/execution/monsters.ts
// ============================================================================
// ОБРАБОТЧИК МОНСТРОВ
// ============================================================================
// Управляет всеми монстрами на уровне:
// - движение в зависимости от типа (patrol, chase, tameable, phased, zombie, boss)
// - взаимодействие с игроком (столкновение = смерть, если не приручен)
// - приручение (кормление кукурузой)
// - оседлывание (езда на прирученном монстре)
// - отвлечение (приманка)
// - эффекты клея, клетки, ловушки (передаются в TilesExecutor)
// ============================================================================

import { Point, Inventory, TileType } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';
import { TilesExecutor } from './tiles';

// ----------------------------------------------------------------------------
// ИНТЕРФЕЙС МОНСТРА (расширенный)
// ----------------------------------------------------------------------------
export interface Monster {
  id: string;
  type: 'patrol' | 'chase' | 'tameable' | 'phased' | 'zombie' | 'boss';
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
  patrolPath?: Point[];      // маршрут для патрульных монстров
  patrolIndex?: number;      // текущий индекс в маршруте
  isTamed: boolean;          // приручен ли?
  isRidden: boolean;         // едет ли на нём игрок?
  isDistracted?: boolean;    // отвлечён ли приманкой?
  distractedTurns?: number;  // сколько ходов ещё отвлечён
  isGlued?: boolean;         // приклеен ли?
  gluedTurns?: number;
  isTrapped?: boolean;       // пойман ли в клетку?
  health?: number;           // здоровье (для будущих механик)
  phaseState?: 'visible' | 'invisible'; // для phased-монстров
}

export class MonstersExecutor {
  private level: any;                 // ссылка на объект уровня (map, objects, width, height)
  private player: any;               // ссылка на игрока (для проверки столкновений и позиции)
  private inventory: Inventory;      // инвентарь (для проверки наличия приманки и т.д.)
  private monsters: Monster[];       // массив всех монстров на уровне
  private lastUpdateTime: number = 0;
  private updateInterval: number = 500; // обновление монстров каждые 500 мс
  private tilesExecutor: TilesExecutor; // для обработки клеток (клей, клетка, ловушка)

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.monsters = level.objects.monsters || [];
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
  }

  // --------------------------------------------------------------------------
  // ПУБЛИЧНЫЙ ЦИКЛ ОБНОВЛЕНИЯ (вызывается из ExecutionEngine по таймеру)
  // --------------------------------------------------------------------------
  public updateMonsters(currentTime: number): void {
    if (currentTime - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = currentTime;

    for (const monster of this.monsters) {
      // Если на монстре едут – он не двигается самостоятельно
      if (monster.isRidden) continue;

      // Если монстр отвлечён – уменьшаем счётчик и пропускаем ход
      if (monster.isDistracted && monster.distractedTurns && monster.distractedTurns > 0) {
        monster.distractedTurns--;
        if (monster.distractedTurns === 0) {
          monster.isDistracted = false;
          log('MonstersExecutor', 'updateMonsters', `Monster ${monster.id} is no longer distracted`);
        }
        continue;
      }

      // Если монстр приклеен – уменьшаем счётчик и не двигаемся
      if (monster.isGlued && monster.gluedTurns && monster.gluedTurns > 0) {
        monster.gluedTurns--;
        if (monster.gluedTurns === 0) {
          monster.isGlued = false;
          log('MonstersExecutor', 'updateMonsters', `Monster ${monster.id} is no longer glued`);
        }
        continue;
      }

      // Если монстр в клетке – не двигается
      if (monster.isTrapped) continue;

      // Пытаемся переместить монстра
      this.moveMonster(monster);
    }
  }

  // --------------------------------------------------------------------------
  // ДВИЖЕНИЕ МОНСТРА В ЗАВИСИМОСТИ ОТ ТИПА
  // --------------------------------------------------------------------------
  private moveMonster(monster: Monster): void {
    const oldPos = { ...monster.position };
    let newPos: Point | null = null;

    switch (monster.type) {
      case 'patrol':
        newPos = this.getPatrolMove(monster);
        break;
      case 'chase':
        newPos = this.getChaseMove(monster);
        break;
      case 'tameable':
        newPos = this.getWanderMove(monster);
        break;
      case 'phased':
        newPos = this.getPhasedMove(monster);
        break;
      case 'zombie':
        newPos = this.getZombieMove(monster);
        break;
      case 'boss':
        newPos = this.getBossMove(monster);
        break;
      default:
        return;
    }

    if (newPos && (newPos.col !== oldPos.col || newPos.row !== oldPos.row)) {
      // Проверка на столкновение с другими монстрами
      const collidingMonster = this.monsters.find(m => m !== monster && m.position.col === newPos!.col && m.position.row === newPos!.row);
      if (!collidingMonster) {
        const tile = this.level.map[newPos.row][newPos.col];
        
        // Механика клея для монстров
        if (tile === TileType.GLUE && !monster.isGlued) {
          monster.isGlued = true;
          monster.gluedTurns = 3;
          logInfo('MonstersExecutor', 'moveMonster', `Monster ${monster.id} glued at (${newPos.col},${newPos.row})`);
          eventBus.emit('MONSTER_GLUED', { monsterId: monster.id, pos: newPos });
          // Монстр не перемещается, остаётся на клею
          return;
        }

        // Механика клетки для монстров
        if (tile === TileType.CAGE && !monster.isTrapped) {
          const trapped = this.tilesExecutor.processCage(newPos, 'monster', monster.id);
          if (trapped) {
            monster.isTrapped = true;
            return;
          }
        }

        // Механика ловушки (превращение в драгоценность)
        if (tile === TileType.TRAP && !monster.isTrapped) {
          const transformed = this.tilesExecutor.processTrap(newPos, monster.id);
          if (transformed) {
            // Монстр удалён из массива в processTrap, поэтому выходим
            return;
          }
        }

        // Перемещаем монстра
        monster.position = newPos;
        log('MonstersExecutor', 'moveMonster', `Monster ${monster.id} moved from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row})`);
        eventBus.emit('MONSTER_MOVED', { monsterId: monster.id, from: oldPos, to: newPos });
        
        // Проверка на столкновение с игроком
        const playerPos = this.player.getPosition();
        if (monster.position.col === playerPos.col && monster.position.row === playerPos.row) {
          if (!monster.isTamed && !monster.isRidden) {
            this.handleMonsterCollision(monster);
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // СТРАТЕГИИ ДВИЖЕНИЯ
  // --------------------------------------------------------------------------

  /** Патрульный монстр: ходит по заданному маршруту (patrolPath) или туда-сюда */
  private getPatrolMove(monster: Monster): Point {
    if (!monster.patrolPath || monster.patrolPath.length === 0) {
      // Нет маршрута – простой возврат при столкновении со стеной
      let dx = 0, dy = 0;
      switch (monster.direction) {
        case 'up':    dy = -1; break;
        case 'down':  dy = 1;  break;
        case 'left':  dx = -1; break;
        case 'right': dx = 1;  break;
      }
      const newPos = { col: monster.position.col + dx, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        return newPos;
      } else {
        // Разворачиваемся
        const opposite: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          up: 'down', down: 'up', left: 'right', right: 'left'
        };
        monster.direction = opposite[monster.direction];
        return monster.position;
      }
    }

    // Движение по маршруту
    if (monster.patrolIndex === undefined) monster.patrolIndex = 0;
    const target = monster.patrolPath[monster.patrolIndex];
    if (target) {
      const newPos = { ...target };
      monster.patrolIndex = (monster.patrolIndex + 1) % monster.patrolPath.length;
      return newPos;
    }
    return monster.position;
  }

  /** Преследующий монстр: двигается к игроку (адаптивно) */
  private getChaseMove(monster: Monster): Point {
    const playerPos = this.player.getPosition();
    const dx = Math.sign(playerPos.col - monster.position.col);
    const dy = Math.sign(playerPos.row - monster.position.row);
    
    // Сначала пытаемся двигаться по горизонтали
    if (dx !== 0) {
      const newPos = { col: monster.position.col + dx, row: monster.position.row };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dx > 0 ? 'right' : 'left';
        return newPos;
      }
    }
    // Затем по вертикали
    if (dy !== 0) {
      const newPos = { col: monster.position.col, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dy > 0 ? 'down' : 'up';
        return newPos;
      }
    }
    return monster.position;
  }

  /** Бродячий монстр (tameable): случайное движение */
  private getWanderMove(monster: Monster): Point {
    const directions = ['up', 'down', 'left', 'right'];
    // Перемешиваем массив для случайного порядка
    const shuffled = [...directions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const dir of shuffled) {
      let dx = 0, dy = 0;
      switch (dir) {
        case 'up':    dy = -1; break;
        case 'down':  dy = 1;  break;
        case 'left':  dx = -1; break;
        case 'right': dx = 1;  break;
      }
      const newPos = { col: monster.position.col + dx, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dir as any;
        return newPos;
      }
    }
    return monster.position;
  }

  /** Фазовый монстр: периодически становится невидимым и может проходить сквозь стены */
  private getPhasedMove(monster: Monster): Point {
    if (!monster.phaseState) monster.phaseState = 'visible';
    // 1% шанс изменить фазу при каждом ходе
    if (Math.random() < 0.01) {
      monster.phaseState = monster.phaseState === 'visible' ? 'invisible' : 'visible';
      log('MonstersExecutor', 'getPhasedMove', `Monster ${monster.id} phase state: ${monster.phaseState}`);
    }
    return this.getWanderMove(monster);
  }

  /** Зомби: преследует игрока как chase */
  private getZombieMove(monster: Monster): Point {
    return this.getChaseMove(monster);
  }

  /** Босс: преследует игрока как chase (может иметь больше здоровья) */
  private getBossMove(monster: Monster): Point {
    return this.getChaseMove(monster);
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДВИЖЕНИЯ
  // --------------------------------------------------------------------------
  private canMonsterMoveTo(monster: Monster, pos: Point): boolean {
    // Проверка границ
    if (pos.col < 0 || pos.col >= this.level.width || pos.row < 0 || pos.row >= this.level.height) {
      return false;
    }
    const tile = this.level.map[pos.row][pos.col];
    
    // Фазовые монстры в невидимом состоянии могут проходить сквозь стены, но не через ямы и кирпичи
    if (monster.type === 'phased' && monster.phaseState === 'invisible') {
      if (tile === TileType.HOLE || tile === TileType.BRICK) return false;
      return true; // могут проходить даже через стены
    }
    
    // Обычные монстры не могут ходить сквозь стены, ямы, кирпичи
    if (tile === TileType.WALL || tile === TileType.HOLE || tile === TileType.BRICK) return false;
    
    // Не могут заходить на клетку с другим монстром
    const monsterHere = this.monsters.find(m => m !== monster && m.position.col === pos.col && m.position.row === pos.row);
    return !monsterHere;
  }

  // --------------------------------------------------------------------------
  // ОБРАБОТКА СТОЛКНОВЕНИЯ С ИГРОКОМ
  // --------------------------------------------------------------------------
  private handleMonsterCollision(monster: Monster): void {
    if (monster.isTamed || monster.isRidden) return;
    
    logInfo('MonstersExecutor', 'handleMonsterCollision', `Monster ${monster.id} collided with player`);
    eventBus.emit('PLAYER_DIED', { cause: `monster_${monster.type}` });
    
    // Дополнительный эффект для зомби
    if (monster.type === 'zombie') {
      eventBus.emit('PLAYER_INFECTED', { monsterId: monster.id });
    }
  }

  // --------------------------------------------------------------------------
  // ПРИРУЧЕНИЕ
  // --------------------------------------------------------------------------
  public tameMonster(monsterId: string): boolean {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (monster && (monster.type === 'tameable' || monster.type === 'patrol')) {
      monster.isTamed = true;
      logInfo('MonstersExecutor', 'tameMonster', `Monster ${monsterId} tamed`);
      eventBus.emit('MONSTER_TAMED', { monsterId });
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // ОСЕДЛЫВАНИЕ
  // --------------------------------------------------------------------------
  public rideMonster(monsterId: string): boolean {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (monster && monster.isTamed && !monster.isRidden) {
      monster.isRidden = true;
      logInfo('MonstersExecutor', 'rideMonster', `Monster ${monsterId} ridden by player`);
      eventBus.emit('MONSTER_RIDDEN', { monsterId });
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // УНИЧТОЖЕНИЕ МОНСТРА (ядром или ловушкой)
  // --------------------------------------------------------------------------
  public killMonster(monsterId: string): boolean {
    const index = this.monsters.findIndex(m => m.id === monsterId);
    if (index !== -1) {
      const monster = this.monsters[index];
      this.monsters.splice(index, 1);
      logInfo('MonstersExecutor', 'killMonster', `Monster ${monsterId} killed`);
      eventBus.emit('MONSTER_KILLED', { monsterId });
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // ПОЛУЧЕНИЕ СПИСКА МОНСТРОВ
  // --------------------------------------------------------------------------
  public getMonsters(): Monster[] {
    return this.monsters;
  }

  // --------------------------------------------------------------------------
  // ОЧИСТКА (при перезагрузке уровня)
  // --------------------------------------------------------------------------
  public clearMonsters(): void {
    this.monsters = [];
  }
}
