// src/modules/execution/interactions.ts
// ============================================================================
// КОМАНДЫ ВЗАИМОДЕЙСТВИЯ: PUSH, SCAN, RIDE
// ============================================================================
// Реализует:
// - PUSH – толкнуть кирпич (BRICK) в направлении взгляда (если за ним есть пустая клетка)
// - SCAN – сканировать область 3x3 вокруг игрока, выявить скрытые объекты (ключи, инструменты, фальшивые стены, телепорты)
// - RIDE – оседлать приручённого монстра (если он стоит перед игроком и не оседлан)
// ============================================================================
// Все команды могут считаться "чёрными ходами" (упрощают прохождение).
// ============================================================================

import { TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class InteractionsExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  // --------------------------------------------------------------------------
  // 1. PUSH – толкнуть кирпич (BRICK) перед игроком
  // --------------------------------------------------------------------------
  public executePush(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    // Определяем направление
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up':    dy = -1; break;
      case 'down':  dy = 1;  break;
      case 'left':  dx = -1; break;
      case 'right': dx = 1;  break;
    }

    const playerPos = this.player.getPosition();
    const brickPos = {
      col: playerPos.col + dx,
      row: playerPos.row + dy,
    };
    const pushPos = {
      col: brickPos.col + dx,
      row: brickPos.row + dy,
    };

    // Проверяем, что перед игроком кирпич, а за ним – пустая клетка (PLATFORM)
    const isBrick = this.level.map[brickPos.row]?.[brickPos.col] === TileType.BRICK;
    const isPushFree = this.level.map[pushPos.row]?.[pushPos.col] === TileType.PLATFORM;

    if (isBrick && isPushFree) {
      // Перемещаем кирпич
      this.level.map[brickPos.row][brickPos.col] = TileType.PLATFORM;
      this.level.map[pushPos.row][pushPos.col] = TileType.BRICK;
      this.backdoorUsed = true;
      logInfo('InteractionsExecutor', 'executePush', `Pushed brick from (${brickPos.col},${brickPos.row}) to (${pushPos.col},${pushPos.row})`);
      eventBus.emit('BRICK_PUSHED', { from: brickPos, to: pushPos });
    } else {
      log('InteractionsExecutor', 'executePush', `Cannot push brick at (${brickPos.col},${brickPos.row})`);
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 2. SCAN – сканировать область 3x3 вокруг игрока
  // --------------------------------------------------------------------------
  public executeScan(playerPos: Point): 'ok' {
    const objects: string[] = [];
    const width = this.level.width;
    const height = this.level.height;

    // Проходим по квадрату 3x3 с центром в игроке
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const scanPos = { col: playerPos.col + dx, row: playerPos.row + dy };
        if (scanPos.col >= 0 && scanPos.col < width && scanPos.row >= 0 && scanPos.row < height) {
          const tile = this.level.map[scanPos.row][scanPos.col];
          
          // Собираем информацию о скрытых/полезных объектах
          if (tile === TileType.KEY) objects.push('key');
          else if (tile === TileType.CORN) objects.push('corn');
          else if (tile === TileType.CORE) objects.push('core');
          else if (tile === TileType.TOOL_DRILL) objects.push('drill');
          else if (tile === TileType.TOOL_HOOK) objects.push('hook');
          else if (tile === TileType.TOOL_WING) objects.push('wing');
          else if (tile === TileType.TOOL_BAIT) objects.push('bait');
          else if (tile === TileType.DOOR_LOCKED) objects.push('locked door');
          else if (tile === TileType.FAKE_WALL) objects.push('fake wall');
          else if (tile === TileType.TELEPORT_IN) objects.push('teleport');
          else if (tile === TileType.BRIDGE_ACTIVE) objects.push('active bridge');
          else if (tile === TileType.BLACK_BOX) objects.push('black box');
        }
      }
    }

    const hintText = `Scanned: ${objects.join(', ') || 'nothing'}`;
    logInfo('InteractionsExecutor', 'executeScan', hintText);
    eventBus.emit('HINT_SHOWN', { hintText, tier: 0 });
    eventBus.emit('SCAN_COMPLETE', { objects });
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 3. RIDE – оседлать приручённого монстра перед игроком
  // --------------------------------------------------------------------------
  public executeRide(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up':    dy = -1; break;
      case 'down':  dy = 1;  break;
      case 'left':  dx = -1; break;
      case 'right': dx = 1;  break;
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    // Ищем монстра на этой позиции
    const monsters = this.level.objects?.monsters || [];
    const monster = monsters.find((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    if (monster && monster.isTamed && !monster.isRidden) {
      monster.isRidden = true;
      this.player.rideMonster(monster);
      this.backdoorUsed = true;
      logInfo('InteractionsExecutor', 'executeRide', `Riding monster at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('MONSTER_RIDDEN', { monsterId: monster.id, pos: targetPos });
    } else {
      log('InteractionsExecutor', 'executeRide', `No tameable rideable monster at (${targetPos.col},${targetPos.row})`);
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ПРОВЕРКИ ЧЁРНОГО ХОДА
  // --------------------------------------------------------------------------
  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
