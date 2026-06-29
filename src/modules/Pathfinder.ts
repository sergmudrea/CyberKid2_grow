// src/modules/Pathfinder.ts
// ============================================================================
// BFS-РЕШАТЕЛЬ ДЛЯ ИГРЫ CYBERKID2
// ============================================================================
// Компактный BFS без зависимостей от Phaser.
// Point = {col, row} — НЕ {x,y}.
// Угол башни: 0=вверх, 90=вправо, 180=вниз, 270=влево (как в Player.angleToDelta).
// ============================================================================

import { LevelData, TileType, Command, ControlMode, Point } from '../types/index';
import { logger } from '../core/Logger';

interface SearchState {
  pos: Point;
  turretAngle: 0 | 90 | 180 | 270;
}

function stateKey(s: SearchState): string {
  return `${s.pos.col},${s.pos.row},${s.turretAngle}`;
}

export class Pathfinder {
  private level: LevelData;

  constructor(level: LevelData) {
    this.level = level;
  }

  // Проходима ли клетка (для BFS)
  private isPassable(col: number, row: number): boolean {
    const { width, height, map } = this.level;
    if (col < 0 || col >= width || row < 0 || row >= height) return false;
    const tile = map[row][col];
    switch (tile) {
      case TileType.WALL:
      case TileType.FAKE_WALL:
      case TileType.HOLE:
      case TileType.LAVA:
      case TileType.WATER:
        return false;
      default:
        return true;
    }
  }

  // Дельта движения по углу башни (0=вверх, 90=вправо, 180=вниз, 270=влево)
  private angleToDelta(angle: number): { dx: number; dy: number } {
    switch (angle) {
      case 0:   return { dx: 0, dy: -1 };
      case 90:  return { dx: 1, dy: 0 };
      case 180: return { dx: 0, dy: 1 };
      case 270: return { dx: -1, dy: 0 };
      default:  return { dx: 0, dy: -1 };
    }
  }

  /**
   * Кратчайший путь клеток от startPos к coinPos (BFS только по позиции).
   * Возвращает массив точек включая startPos и coinPos.
   */
  findOptimalPath(): Point[] | null {
    const { startPos, coinPos } = this.level;
    if (!this.isPassable(startPos.col, startPos.row)) return null;
    if (!this.isPassable(coinPos.col, coinPos.row) &&
        !(coinPos.col === this.level.coinPos.col && coinPos.row === this.level.coinPos.row)) {
      return null;
    }

    type PosKey = string;
    const queue: { pos: Point; path: Point[] }[] = [{ pos: { ...startPos }, path: [{ ...startPos }] }];
    const visited = new Set<PosKey>();
    visited.add(`${startPos.col},${startPos.row}`);

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];

    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;

      if (pos.col === coinPos.col && pos.row === coinPos.row) {
        return path;
      }

      for (const dir of dirs) {
        const nPos = { col: pos.col + dir.dx, row: pos.row + dir.dy };
        const key = `${nPos.col},${nPos.row}`;
        if (!visited.has(key) && this.isPassable(nPos.col, nPos.row)) {
          visited.add(key);
          queue.push({ pos: nPos, path: [...path, nPos] });
        }
      }

      // Также цель может быть непроходимым (GOAL tile) — добавим специальную проверку
      for (const dir of dirs) {
        const nPos = { col: pos.col + dir.dx, row: pos.row + dir.dy };
        if (nPos.col === coinPos.col && nPos.row === coinPos.row) {
          const key = `${nPos.col},${nPos.row}`;
          if (!visited.has(key)) {
            visited.add(key);
            return [...path, nPos];
          }
        }
      }
    }

    return null;
  }

  /**
   * BFS по состоянию (pos + turretAngle) для SEPARATE режима.
   * Команды: TURN_LEFT, TURN_RIGHT, MOVE_FORWARD.
   */
  private findCommandSolutionSeparate(): Command[] | null {
    const { startPos, coinPos, startTurretAngle } = this.level;
    const initAngle = ((startTurretAngle ?? 0) as 0 | 90 | 180 | 270);

    const initState: SearchState = {
      pos: { ...startPos },
      turretAngle: initAngle,
    };

    const MAX_STATES = 2000;
    const queue: { state: SearchState; commands: Command[] }[] = [
      { state: initState, commands: [] },
    ];
    const visited = new Set<string>();
    visited.add(stateKey(initState));

    while (queue.length > 0 && visited.size <= MAX_STATES) {
      const { state, commands } = queue.shift()!;

      if (state.pos.col === coinPos.col && state.pos.row === coinPos.row) {
        return commands;
      }

      // TURN_LEFT: угол - 90
      {
        const newAngle = ((state.turretAngle - 90 + 360) % 360) as 0 | 90 | 180 | 270;
        const nextState: SearchState = { pos: { ...state.pos }, turretAngle: newAngle };
        const key = stateKey(nextState);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: nextState, commands: [...commands, Command.TURN_LEFT] });
        }
      }

      // TURN_RIGHT: угол + 90
      {
        const newAngle = ((state.turretAngle + 90) % 360) as 0 | 90 | 180 | 270;
        const nextState: SearchState = { pos: { ...state.pos }, turretAngle: newAngle };
        const key = stateKey(nextState);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: nextState, commands: [...commands, Command.TURN_RIGHT] });
        }
      }

      // MOVE_FORWARD: движение по направлению башни
      {
        const delta = this.angleToDelta(state.turretAngle);
        const nPos = { col: state.pos.col + delta.dx, row: state.pos.row + delta.dy };
        if (
          (this.isPassable(nPos.col, nPos.row) ||
            (nPos.col === coinPos.col && nPos.row === coinPos.row))
        ) {
          const nextState: SearchState = { pos: nPos, turretAngle: state.turretAngle };
          const key = stateKey(nextState);
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ state: nextState, commands: [...commands, Command.MOVE_FORWARD] });
          }
        }
      }
    }

    return null;
  }

  /**
   * BFS по состоянию для CLASSIC режима.
   * Команды: UP, DOWN, LEFT, RIGHT.
   */
  private findCommandSolutionClassic(): Command[] | null {
    const { startPos, coinPos } = this.level;

    const dirs: { cmd: Command; dx: number; dy: number }[] = [
      { cmd: Command.UP, dx: 0, dy: -1 },
      { cmd: Command.DOWN, dx: 0, dy: 1 },
      { cmd: Command.LEFT, dx: -1, dy: 0 },
      { cmd: Command.RIGHT, dx: 1, dy: 0 },
    ];

    const MAX_STATES = 2000;
    const queue: { pos: Point; commands: Command[] }[] = [
      { pos: { ...startPos }, commands: [] },
    ];
    const visited = new Set<string>();
    visited.add(`${startPos.col},${startPos.row}`);

    while (queue.length > 0 && visited.size <= MAX_STATES) {
      const { pos, commands } = queue.shift()!;

      if (pos.col === coinPos.col && pos.row === coinPos.row) {
        return commands;
      }

      for (const dir of dirs) {
        const nPos = { col: pos.col + dir.dx, row: pos.row + dir.dy };
        const key = `${nPos.col},${nPos.row}`;
        if (
          !visited.has(key) &&
          (this.isPassable(nPos.col, nPos.row) ||
            (nPos.col === coinPos.col && nPos.row === coinPos.row))
        ) {
          visited.add(key);
          queue.push({ pos: nPos, commands: [...commands, dir.cmd] });
        }
      }
    }

    return null;
  }

  /**
   * Найти последовательность команд до цели.
   * SEPARATE — TURN_LEFT/TURN_RIGHT/MOVE_FORWARD
   * CLASSIC  — UP/DOWN/LEFT/RIGHT
   */
  findCommandSolution(controlMode: ControlMode): Command[] | null {
    logger.debug('Pathfinder', 'findCommandSolution', `controlMode=${controlMode}`);
    if (controlMode === ControlMode.CLASSIC) {
      return this.findCommandSolutionClassic();
    }
    return this.findCommandSolutionSeparate();
  }

  isSolvable(): boolean {
    return this.findOptimalPath() !== null;
  }

  getOptimalSteps(): number {
    const path = this.findOptimalPath();
    return path ? path.length - 1 : 0;
  }

  /**
   * Следующий шаг от playerPos к цели по BFS-пути.
   */
  getHint(playerPos: Point): { dir: 'up' | 'down' | 'left' | 'right'; text: string } | null {
    // Запустим BFS от текущей позиции игрока
    const { coinPos } = this.level;
    const dirs: { dir: 'up' | 'down' | 'left' | 'right'; dx: number; dy: number }[] = [
      { dir: 'up', dx: 0, dy: -1 },
      { dir: 'down', dx: 0, dy: 1 },
      { dir: 'left', dx: -1, dy: 0 },
      { dir: 'right', dx: 1, dy: 0 },
    ];

    const queue: { pos: Point; firstDir: 'up' | 'down' | 'left' | 'right' | null }[] = [
      { pos: { ...playerPos }, firstDir: null },
    ];
    const visited = new Set<string>();
    visited.add(`${playerPos.col},${playerPos.row}`);

    while (queue.length > 0) {
      const { pos, firstDir } = queue.shift()!;

      if (pos.col === coinPos.col && pos.row === coinPos.row) {
        if (!firstDir) return null;
        const dirNames: Record<string, string> = {
          up: 'вверх',
          down: 'вниз',
          left: 'влево',
          right: 'вправо',
        };
        return { dir: firstDir, text: `Иди ${dirNames[firstDir]}` };
      }

      for (const d of dirs) {
        const nPos = { col: pos.col + d.dx, row: pos.row + d.dy };
        const key = `${nPos.col},${nPos.row}`;
        if (
          !visited.has(key) &&
          (this.isPassable(nPos.col, nPos.row) ||
            (nPos.col === coinPos.col && nPos.row === coinPos.row))
        ) {
          visited.add(key);
          queue.push({ pos: nPos, firstDir: firstDir ?? d.dir });
        }
      }
    }

    return null;
  }
}
