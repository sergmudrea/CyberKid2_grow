// src/modules/execution/types.ts
// Типы данных для ExecutionEngine

import { Point, Inventory, Command, TileType, Monster } from '../../types/index';

// AST Node types
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

// Call frame for functions
export interface CallFrame {
  functionName: string;
  returnNodeIndex: number;
  localVars: Map<string, any>;
  nodeStack: ASTNode[];
  nodeIndex: number;
  parameters: Map<string, any>;
}

// Class definition for OOP
export interface ClassDef {
  name: string;
  properties: Map<string, any>;
  methods: Map<string, ASTNode[]>;
  parentClass?: string;
}

// Instance of a class
export interface Instance {
  classId: string;
  properties: Map<string, any>;
  methods: Map<string, ASTNode[]>;
}

// Clone for parallelism
export interface CloneInfo {
  id: string;
  position: Point;
  inventory: Inventory;
  ast: ASTNode[];
  nodeIndex: number;
}

// Teleport pair
export interface TeleportPair {
  id: string;
  entry: Point;
  exit: Point;
}

// Conveyor belt
export interface Conveyor {
  id: string;
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
}

// Spring
export interface Spring {
  id: string;
  position: Point;
  launchDirection: 'up' | 'down' | 'left' | 'right';
  force: number;
}

// Black Box mapping
export interface BlackBox {
  id: string;
  position: Point;
  inputCount: number;
  outputCount: number;
  mapping: string;
}

// Sorter
export interface Sorter {
  id: string;
  position: Point;
  order: 'asc' | 'desc' | 'fifo' | 'lifo';
}

// Button
export interface Button {
  id: string;
  position: Point;
  isPressed: boolean;
  linkedObjects: string[];
}

// Lever
export interface Lever {
  id: string;
  position: Point;
  state: boolean;
  linkedObjects: string[];
}

// Timer
export interface Timer {
  id: string;
  position: Point;
  delay: number;
  active: boolean;
  remaining: number;
  linkedObjects: string[];
}

// Sensor
export interface Sensor {
  id: string;
  position: Point;
  range: number;
  active: boolean;
}

// Result of execution
export interface ExecutionResult {
  success: boolean;
  steps: number;
  finalInventory: Inventory;
  monstersState: Monster[];
  backdoorUsed: boolean;
  stars: number;
}

// Execution status for external use
export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  currentCommandIndex: number;
  totalCommands: number;
  stepCount: number;
  lastError?: string;
}
