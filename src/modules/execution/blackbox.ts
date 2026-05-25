// src/modules/execution/blackbox.ts
// Реализация чёрного ящика (Black Box) — функции преобразования входа в выход

import { Inventory, TileType } from '../../types/index';
import { log, logError, logInfo } from './helpers';

export interface BlackBoxMapping {
  id: string;
  inputCount: number;
  outputCount: number;
  mapping: (input: any, inventory?: Inventory) => any;
}

export class BlackBoxProcessor {
  private mappings: Map<string, BlackBoxMapping> = new Map();
  private inventory: Inventory;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
    this.initDefaultMappings();
  }

  private initDefaultMappings(): void {
    // SISO (Single Input Single Output) — 1 вход, 1 выход
    this.mappings.set('identity', {
      id: 'identity',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => input,
    });

    this.mappings.set('double', {
      id: 'double',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (typeof input === 'number') return input * 2;
        return input;
      },
    });

    this.mappings.set('half', {
      id: 'half',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (typeof input === 'number') return input / 2;
        return input;
      },
    });

    this.mappings.set('increment', {
      id: 'increment',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (typeof input === 'number') return input + 1;
        return input;
      },
    });

    this.mappings.set('decrement', {
      id: 'decrement',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (typeof input === 'number') return input - 1;
        return input;
      },
    });

    // Трансформация предметов
    this.mappings.set('corn_to_core', {
      id: 'corn_to_core',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (input === 'corn') return 'core';
        return input;
      },
    });

    this.mappings.set('core_to_corn', {
      id: 'core_to_corn',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (input === 'core') return 'corn';
        return input;
      },
    });

    this.mappings.set('key_to_drill', {
      id: 'key_to_drill',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        if (input === 'key') return 'drill';
        return input;
      },
    });

    // Трансформация направления
    this.mappings.set('reverse_direction', {
      id: 'reverse_direction',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        const dirs: Record<string, string> = {
          up: 'down',
          down: 'up',
          left: 'right',
          right: 'left',
        };
        return dirs[input] || input;
      },
    });

    this.mappings.set('rotate_left', {
      id: 'rotate_left',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        const dirs: Record<string, string> = {
          up: 'left',
          left: 'down',
          down: 'right',
          right: 'up',
        };
        return dirs[input] || input;
      },
    });

    this.mappings.set('rotate_right', {
      id: 'rotate_right',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        const dirs: Record<string, string> = {
          up: 'right',
          right: 'down',
          down: 'left',
          left: 'up',
        };
        return dirs[input] || input;
      },
    });

    // MIMO (Multiple Input Multiple Output) — 2 входа, 2 выхода
    this.mappings.set('swap_inventory', {
      id: 'swap_inventory',
      inputCount: 2,
      outputCount: 2,
      mapping: (input, inventory) => {
        if (inventory) {
          const temp = inventory.corn;
          inventory.corn = inventory.cores;
          inventory.cores = temp;
        }
        return input;
      },
    });

    this.mappings.set('combine', {
      id: 'combine',
      inputCount: 2,
      outputCount: 1,
      mapping: (input) => {
        if (input.corn && input.core) return 'power_core';
        return input;
      },
    });
  }

  public addMapping(id: string, mapping: BlackBoxMapping): void {
    this.mappings.set(id, mapping);
    logInfo('BlackBoxProcessor', 'addMapping', `Added mapping: ${id}`);
  }

  public process(mappingId: string, input: any): any {
    const mapping = this.mappings.get(mappingId);
    if (!mapping) {
      logError('BlackBoxProcessor', 'process', `Mapping not found: ${mappingId}`);
      return input;
    }

    log('BlackBoxProcessor', 'process', `Processing mapping: ${mappingId}`, { input });

    try {
      const output = mapping.mapping(input, this.inventory);
      logInfo('BlackBoxProcessor', 'process', `Mapping result: ${output}`);
      return output;
    } catch (error) {
      logError('BlackBoxProcessor', 'process', `Error processing mapping: ${mappingId}`, error);
      return input;
    }
  }

  public processSISO(mappingId: string, input: any): any {
    const mapping = this.mappings.get(mappingId);
    if (!mapping || mapping.inputCount !== 1 || mapping.outputCount !== 1) {
      logError('BlackBoxProcessor', 'processSISO', `Invalid mapping for SISO: ${mappingId}`);
      return input;
    }
    return this.process(mappingId, input);
  }

  public processMIMO(mappingId: string, inputs: any[]): any {
    const mapping = this.mappings.get(mappingId);
    if (!mapping) {
      logError('BlackBoxProcessor', 'processMIMO', `Mapping not found: ${mappingId}`);
      return inputs;
    }
    return this.process(mappingId, inputs);
  }

  public getMapping(id: string): BlackBoxMapping | undefined {
    return this.mappings.get(id);
  }

  public getAllMappings(): string[] {
    return Array.from(this.mappings.keys());
  }
}
