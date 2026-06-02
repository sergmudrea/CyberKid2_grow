// src/modules/execution/monsters.ts
// ============================================================================
// ОБРАБОТЧИК МОНСТРОВ – ПОЛНАЯ ВЕРСИЯ
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

export interface Monster {
  id: string;
  type: 'patrol' | 'chase' | 'tameable' | 'phased' | 'zombie' | 'boss';
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
  patrolPath?: Point[];
  patrolIndex?: number;
  isTamed: boolean;
  isRidden: boolean;
  isDistracted?: boolean;
  distractedTurns?: number;
  isGlued?: boolean;
  gluedTurns?: number;
  isTrapped?: boolean;
  health?: number;
  phaseState?: 'visible' | 'invisible';
}

export class MonstersExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private monsters: Monster[];
  private lastUpdateTime: number = 0;
  private updateInterval: number = 500;
  private tilesExecutor: TilesExecutor;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    // ЗАЩИТА: если нет level.objects, создаём пустой объект
    if (!this.level.objects) {
      this.level.objects = {};
    }
    this.monsters = this.level.objects.monsters || [];
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
  }

  public updateMonsters(currentTime: number): void {
    if (currentTime - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = currentTime;

    for (const monster of this.monsters) {
      if (monster.isRidden) continue;
      if (monster.isDistracted && monster.distractedTurns && monster.distractedTurns > 0) {
        monster.distractedTurns--;
        if (monster.distractedTurns === 0) {
          monster.isDistracted = false;
          log('MonstersExecutor', 'updateMonsters', `Monster ${monster.id} is no longer distracted`);
        }
        continue;
      }
      if (monster.isGlued && monster.gluedTurns && monster.gluedTurns > 0) {
        monster.gluedTurns--;
        if (monster.gluedTurns === 0) {
          monster.isGlued = false;
          log('MonstersExecutor', 'updateMonsters', `Monster ${monster.id} is no longer glued`);
        }
        continue;
      }
      if (monster.isTrapped) continue;
      this.moveMonster(monster);
    }
  }

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
      const collidingMonster = this.monsters.find(m => m !== monster && m.position.col === newPos!.col && m.position.row === newPos!.row);
      if (!collidingMonster) {
        const tile = this.level.map[newPos.row][newPos.col];

        if (tile === TileType.GLUE && !monster.isGlued) {
          monster.isGlued = true;
          monster.gluedTurns = 3;
          logInfo('MonstersExecutor', 'moveMonster', `Monster ${monster.id} glued at (${newPos.col},${newPos.row})`);
          eventBus.emit('MONSTER_GLUED', { monsterId: monster.id, pos: newPos });
          return;
        }

        if (tile === TileType.CAGE && !monster.isTrapped) {
          const trapped = this.tilesExecutor.processCage(newPos, 'monster', monster.id);
          if (trapped) {
            monster.isTrapped = true;
            return;
          }
        }

        if (tile === TileType.TRAP && !monster.isTrapped) {
          const transformed = this.tilesExecutor.processTrap(newPos, monster.id);
          if (transformed) {
            return;
          }
        }

        monster.position = newPos;
        log('MonstersExecutor', 'moveMonster', `Monster ${monster.id} moved from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row})`);
        eventBus.emit('MONSTER_MOVED', { monsterId: monster.id, from: oldPos, to: newPos });

        const playerPos = this.player.getPosition();
        if (monster.position.col === playerPos.col && monster.position.row === playerPos.row) {
          if (!monster.isTamed && !monster.isRidden) {
            this.handleMonsterCollision(monster);
          }
        }
      }
    }
  }

  private getPatrolMove(monster: Monster): Point {
    if (!monster.patrolPath || monster.patrolPath.length === 0) {
      let dx = 0, dy = 0;
      switch (monster.direction) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }
      const newPos = { col: monster.position.col + dx, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        return newPos;
      } else {
        const opposite: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          up: 'down', down: 'up', left: 'right', right: 'left'
        };
        monster.direction = opposite[monster.direction];
        return monster.position;
      }
    }

    if (monster.patrolIndex === undefined) monster.patrolIndex = 0;
    const target = monster.patrolPath[monster.patrolIndex];
    if (target) {
      const newPos = { ...target };
      monster.patrolIndex = (monster.patrolIndex + 1) % monster.patrolPath.length;
      return newPos;
    }
    return monster.position;
  }

  private getChaseMove(monster: Monster): Point {
    const playerPos = this.player.getPosition();
    const dx = Math.sign(playerPos.col - monster.position.col);
    const dy = Math.sign(playerPos.row - monster.position.row);

    if (dx !== 0) {
      const newPos = { col: monster.position.col + dx, row: monster.position.row };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dx > 0 ? 'right' : 'left';
        return newPos;
      }
    }
    if (dy !== 0) {
      const newPos = { col: monster.position.col, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dy > 0 ? 'down' : 'up';
        return newPos;
      }
    }
    return monster.position;
  }

  private getWanderMove(monster: Monster): Point {
    const directions = ['up', 'down', 'left', 'right'];
    const shuffled = [...directions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const dir of shuffled) {
      let dx = 0, dy = 0;
      switch (dir) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }
      const newPos = { col: monster.position.col + dx, row: monster.position.row + dy };
      if (this.canMonsterMoveTo(monster, newPos)) {
        monster.direction = dir as any;
        return newPos;
      }
    }
    return monster.position;
  }

  private getPhasedMove(monster: Monster): Point {
    if (!monster.phaseState) monster.phaseState = 'visible';
    if (Math.random() < 0.01) {
      monster.phaseState = monster.phaseState === 'visible' ? 'invisible' : 'visible';
      log('MonstersExecutor', 'getPhasedMove', `Monster ${monster.id} phase state: ${monster.phaseState}`);
    }
    return this.getWanderMove(monster);
  }

  private getZombieMove(monster: Monster): Point {
    return this.getChaseMove(monster);
  }

  private getBossMove(monster: Monster): Point {
    return this.getChaseMove(monster);
  }

  private canMonsterMoveTo(monster: Monster, pos: Point): boolean {
    if (pos.col < 0 || pos.col >= this.level.width || pos.row < 0 || pos.row >= this.level.height) {
      return false;
    }
    const tile = this.level.map[pos.row][pos.col];
    if (monster.type === 'phased' && monster.phaseState === 'invisible') {
      if (tile === TileType.HOLE || tile === TileType.BRICK) return false;
      return true;
    }
    if (tile === TileType.WALL || tile === TileType.HOLE || tile === TileType.BRICK) return false;
    const monsterHere = this.monsters.find(m => m !== monster && m.position.col === pos.col && m.position.row === pos.row);
    return !monsterHere;
  }

  private handleMonsterCollision(monster: Monster): void {
    if (monster.isTamed || monster.isRidden) return;
    logInfo('MonstersExecutor', 'handleMonsterCollision', `Monster ${monster.id} collided with player`);
    eventBus.emit('PLAYER_DIED', { cause: `monster_${monster.type}` });
    if (monster.type === 'zombie') {
      eventBus.emit('PLAYER_INFECTED', { monsterId: monster.id });
    }
  }

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

  public getMonsters(): Monster[] {
    return this.monsters;
  }

  public clearMonsters(): void {
    this.monsters = [];
  }
}
