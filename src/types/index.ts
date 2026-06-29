// src/types/index.ts
// ============================================================================
// ОСНОВНЫЕ ТИПЫ ДЛЯ ИГРЫ CYBERKID: ТАНКИСТ (ПАТЧ 2.0)
// ============================================================================

export enum Command {
  // ---------- Движение и поворот башни (НОВЫЕ) ----------
  MOVE_FORWARD = 'move_forward',
  MOVE_BACKWARD = 'move_backward',
  TURN_LEFT = 'turn_left',
  TURN_RIGHT = 'turn_right',
  TURN_AROUND = 'turn_around',
  SYNC_BODY = 'sync_body',
  SET_ANGLE = 'set_angle',
  RELATIVE_TURN = 'relative_turn',
  SHOW_AIM = 'show_aim',

  // ---------- Условные и циклические конструкции для углов ----------
  IF_ANGLE = 'if_angle',
  WHILE_NOT_FACING = 'while_not_facing',

  // ---------- ОСТАЛЬНЫЕ СТАРЫЕ КОМАНДЫ ----------
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
  PICKUP = 'pickup',
  DROP = 'drop',
  USE_KEY = 'use_key',
  DRILL = 'drill',
  HOOK = 'hook',
  WING = 'wing',
  BAIT = 'bait',
  THROW = 'throw',
  FEED = 'feed',
  TIME_SLOW = 'time_slow',
  TIME_FAST = 'time_fast',
  WAIT = 'wait',
  DEF = 'def',
  CALL = 'call',
  RETURN = 'return',
  PARAM = 'param',
  CLASS = 'class',
  NEW = 'new',
  METHOD = 'method',
  CLONE = 'clone',
  JOIN = 'join',
  PUSH = 'push',
  SCAN = 'scan',
  RIDE = 'ride',
  BLACK_BOX = 'black_box',
  FOR_N = 'for_n',
  FOR_LOOP = 'for_loop',
  WHILE_MONSTER = 'while_monster',
  WHILE_WALL = 'while_wall',
  WHILE_HOLE = 'while_hole',
  REPEAT = 'repeat',
  IF_WALL = 'if_wall',
  IF_HOLE = 'if_hole',
  IF_MONSTER = 'if_monster',
  IF_COIN = 'if_coin',
  IF_KEY = 'if_key',
  IF_NO_KEY = 'if_no_key',
  ELSE = 'else',
  START = 'start',
  END = 'end'
}

export enum TileType {
  PLATFORM = 0,
  WALL = 1,
  HOLE = 2,
  GOAL = 3,
  START = 4,
  BRICK = 5,
  KEY = 10,
  DOOR_LOCKED = 11,
  DOOR_UNLOCKED = 12,
  CORN = 13,
  CORE = 14,
  TOOL_DRILL = 15,
  TOOL_HOOK = 16,
  TOOL_WING = 17,
  TOOL_BAIT = 18,
  CONVEYOR_UP = 19,
  CONVEYOR_DOWN = 20,
  CONVEYOR_LEFT = 21,
  CONVEYOR_RIGHT = 22,
  SPRING = 23,
  TELEPORT_IN = 24,
  TELEPORT_OUT = 25,
  BLACK_BOX = 26,
  SENSOR = 27,
  LEVER = 28,
  BUTTON = 29,
  TIMER = 30,
  SORTER = 31,
  LAVA = 32,
  WATER = 33,
  BRIDGE = 34,
  BRIDGE_ACTIVE = 35,
  ROCKET = 36,
  MIRROR = 37,
  CLONE_POINT = 38,
  RIDE_POINT = 39,
  NEURO_STAB = 40,
  GLUE = 41,
  CAGE = 42,
  TRAP = 43,
  CAGE_KEY = 44,
  PRISONER = 45,
  GEM = 46,
  // НОВЫЕ ДЛЯ ПАТЧА 2.0
  MAGNET = 50,
  SLOW_FIELD = 51,
  FAKE_WALL = 52
}

export interface Point {
  col: number;
  row: number;
}

export interface Inventory {
  keys: string[];
  corn: number;
  cores: number;
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  tools: string[];
}

// НОВЫЕ ТИПЫ ДЛЯ ПАТЧА 2.0
export enum ControlMode {
  CLASSIC = 'classic',
  SEPARATE = 'separate'
}

export interface Magnet {
  id: string;
  position: Point;
  strength: number;
}

export interface SlowField {
  id: string;
  position: Point;
  factor: number;
}

export interface LevelData {
  id: string;
  name: string;
  worldId: string;
  width: number;
  height: number;
  map: TileType[][];
  startPos: Point;
  startTurretAngle?: number;
  startHullDirection?: 'up'|'down'|'left'|'right';
  coinPos: Point;
  optimalSteps?: number;
  allowedCommands?: Command[];
  controlMode?: ControlMode;
  objects?: any;
  items?: { id: string; pos: Point }[];
}

export interface LevelStats {
  stars: number;
  attempts: number;
  bestSteps: number;
  completed: boolean;
  lastPlayed: number;
  blackStar?: boolean;
  explorationUsed?: boolean;
  backdoorUsed?: boolean;
}

export interface PlayerProgress {
  totalStars: number;
  totalBlackStars: number;
  levelsCompleted: string[];
  perfectLevels: string[];
  levelStats: Record<string, LevelStats>;
  totalAttempts: number;
  totalDeaths: number;
  deathsByType: Record<string, number>;
  totalPlayTimeSec: number;
  explorationUsedCount: number;
  backdoorsFound: number;
  unlockedWorlds: string[];
  lastPlayedWorld: string;
  lastPlayedLevelId: string;
  achievements: any[];
  settings: any;
}

export type LearningMode = 'kiddo' | 'scholar' | 'dev_student' | 'developer';

export interface UserSettings {
  language: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  controlMode: ControlMode;
  learningMode: LearningMode;
  tutorialEnabled: boolean;
  autoHints: boolean;
  vibrationEnabled: boolean;
  developerMode: boolean;
  classicModeCompatibility?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  steps: number;
  finalInventory: Inventory;
  monstersState: any;
  backdoorUsed: boolean;
  stars: number;
}

export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  currentCommandIndex: number;
  totalCommands: number;
  stepCount: number;
  lastError?: string;
}

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

export interface GameEvent {
  type: string;
  payload?: any;
}
