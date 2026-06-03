// src/modules/execution/blackbox.ts
// ============================================================================
// ЧЁРНЫЙ ЯЩИК (BLACK BOX) – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// Реализует преобразование предметов (SISO, MIMO) при активации чёрного ящика.
// Поддерживаемые маппинги:
// - identity, double, half, increment, decrement
// - corn_to_core, core_to_corn, key_to_drill
// - reverse_direction, rotate_left, rotate_right
// - swap_inventory, combine
// ============================================================================

import { Inventory } from '../../types/index';
import { log, logInfo, logError } from './helpers';

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
    // SISO (один вход, один выход)
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

    // Трансформация направления (может использоваться для будущих механик)
    this.mappings.set('reverse_direction', {
      id: 'reverse_direction',
      inputCount: 1,
      outputCount: 1,
      mapping: (input) => {
        const dirs: Record<string, string> = {
          up: 'down', down: 'up', left: 'right', right: 'left',
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
          up: 'left', left: 'down', down: 'right', right: 'up',
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
          up: 'right', right: 'down', down: 'left', left: 'up',
        };
        return dirs[input] || input;
      },
    });

    // MIMO
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
        if (input && input.corn && input.core) return 'power_core';
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

  public applySISO(mappingId: string, inputType: string, removeInput: boolean = true): void {
    const mapping = this.mappings.get(mappingId);
    if (!mapping || mapping.inputCount !== 1 || mapping.outputCount !== 1) {
      logError('BlackBoxProcessor', 'applySISO', `Invalid mapping for SISO: ${mappingId}`);
      return;
    }

    let input = null;
    if (inputType === 'corn' && this.inventory.corn > 0) input = 'corn';
    else if (inputType === 'core' && this.inventory.cores > 0) input = 'core';
    else if (inputType === 'key' && this.inventory.keys.length > 0) input = this.inventory.keys[0];
    else if (inputType === 'drill' && this.inventory.hasDrill) input = 'drill';
    else if (inputType === 'hook' && this.inventory.hasHook) input = 'hook';
    else if (inputType === 'wing' && this.inventory.hasWing) input = 'wing';
    else if (inputType === 'bait' && this.inventory.hasBait) input = 'bait';
    else return;

    const output = this.process(mappingId, input);

    if (removeInput) {
      if (input === 'corn') this.inventory.corn--;
      else if (input === 'core') this.inventory.cores--;
      else if (input === 'drill') this.inventory.hasDrill = false;
      else if (input === 'hook') this.inventory.hasHook = false;
      else if (input === 'wing') this.inventory.hasWing = false;
      else if (input === 'bait') this.inventory.hasBait = false;
      else if (typeof input === 'string' && input.startsWith('key_')) this.inventory.keys.pop();
    }

    if (output === 'corn') this.inventory.corn++;
    else if (output === 'core') this.inventory.cores++;
    else if (output === 'drill') this.inventory.hasDrill = true;
    else if (output === 'hook') this.inventory.hasHook = true;
    else if (output === 'wing') this.inventory.hasWing = true;
    else if (output === 'bait') this.inventory.hasBait = true;
    else if (output === 'power_core') this.inventory.cores += 3;
    else if (typeof output === 'string' && output.startsWith('key_')) this.inventory.keys.push(output);
  }

  public applyMIMO(mappingId: string): void {
    const mapping = this.mappings.get(mappingId);
    if (!mapping || mapping.inputCount !== 2) {
      logError('BlackBoxProcessor', 'applyMIMO', `Invalid mapping for MIMO: ${mappingId}`);
      return;
    }
    this.process(mappingId, null);
  }

  public getMapping(id: string): BlackBoxMapping | undefined {
    return this.mappings.get(id);
  }

  public getAllMappings(): string[] {
    return Array.from(this.mappings.keys());
  }
}
