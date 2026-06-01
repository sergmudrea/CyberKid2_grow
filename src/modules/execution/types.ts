// src/modules/execution/types.ts
// ============================================================================
// ТИПЫ ДАННЫХ ДЛЯ EXECUTION ENGINE
// ============================================================================
// Содержит внутренние типы, используемые парсером, раннером и подсистемами:
// - ASTNode – узел абстрактного синтаксического дерева
// - CallFrame – фрейм вызова функции
// - ClassDef, Instance – для ООП
// - CloneInfo – для параллелизма (клоны)
// - TeleportPair, Conveyor, Spring, BlackBox, Sorter, Button, Lever, Timer, Sensor – описание объектов уровня
// - ExecutionResult, ExecutionStatus – результаты выполнения
// ============================================================================

import { Point, Inventory, Command, TileType, Monster } from '../../types/index';

// ----------------------------------------------------------------------------
// 1. AST И БЛОКИ
// ----------------------------------------------------------------------------
export interface ASTNode {
  type: 'command' | 'block' | 'function' | 'class' | 'method' | 'condition';
  command?: Command;
  blockType?: 'for' | 'while' | 'repeat' | 'if' | 'else' | 'if_else';
  children?: ASTNode[];
  repeatCount?: number;
  condition?: Command;
  conditionValue?: boolean;
  functionName?: string;
  parameters?: string[];
  className?: string;
  methodName?: string;
  propertyName?: string;
}

// ----------------------------------------------------------------------------
// 2. СТЕК ВЫЗОВОВ ФУНКЦИЙ
// ----------------------------------------------------------------------------
export interface CallFrame {
  functionName: string;
  returnNodeIndex: number;      // индекс узла, куда вернуться после RETURN
  localVars: Map<string, any>;  // локальные переменные (параметры)
  nodeStack: ASTNode[];         // родительский AST (откуда вызвали)
  nodeIndex: number;            // текущий индекс в родительском AST
  parameters: Map<string, any>; // запасной вариант
}

// ----------------------------------------------------------------------------
// 3. ООП: КЛАССЫ И ЭКЗЕМПЛЯРЫ
// ----------------------------------------------------------------------------
export interface ClassDef {
  name: string;
  properties: Map<string, any>;
  methods: Map<string, ASTNode[]>;
  parentClass?: string;
}

export interface Instance {
  classId: string;
  properties: Map<string, any>;
  methods: Map<string, ASTNode[]>;
}

// ----------------------------------------------------------------------------
// 4. ПАРАЛЛЕЛИЗМ: КЛОНЫ
// ----------------------------------------------------------------------------
export interface CloneInfo {
  id: string;
  position: Point;
  inventory: Inventory;
  ast: ASTNode[];
  nodeIndex: number;
}

// ----------------------------------------------------------------------------
// 5. ОБЪЕКТЫ УРОВНЯ (ДЛЯ УДОБСТВА)
// ----------------------------------------------------------------------------
export interface TeleportPair {
  id: string;
  entry: Point;
  exit: Point;
}

export interface Conveyor {
  id: string;
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface Spring {
  id: string;
  position: Point;
  launchDirection: 'up' | 'down' | 'left' | 'right';
  force: number;
}

export interface BlackBox {
  id: string;
  position: Point;
  inputCount: number;
  outputCount: number;
  mapping: string;
}

export interface Sorter {
  id: string;
  position: Point;
  order: 'asc' | 'desc' | 'fifo' | 'lifo';
}

export interface Button {
  id: string;
  position: Point;
  isPressed: boolean;
  linkedObjects: string[];
}

export interface Lever {
  id: string;
  position: Point;
  state: boolean;
  linkedObjects: string[];
}

export interface Timer {
  id: string;
  position: Point;
  delay: number;
  active: boolean;
  remaining: number;
  linkedObjects: string[];
}

export interface Sensor {
  id: string;
  position: Point;
  range: number;
  active: boolean;
}

// ----------------------------------------------------------------------------
// 6. РЕЗУЛЬТАТЫ И СТАТУСЫ ВЫПОЛНЕНИЯ
// ----------------------------------------------------------------------------
export interface ExecutionResult {
  success: boolean;
  steps: number;
  finalInventory: Inventory;
  monstersState: Monster[];
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
