// src/modules/execution/time.ts
// ============================================================================
// УПРАВЛЕНИЕ ВРЕМЕНЕМ – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// Реализует команды:
// - TIME_SLOW – замедлить выполнение программы (множитель скорости 0.5)
// - TIME_FAST – ускорить выполнение программы (множитель скорости 2)
// - WAIT – приостановить выполнение на 1 секунду (с учётом множителя скорости)
// ============================================================================
// В патче 2.0 добавлена поддержка временного замедления через SLOW_FIELD,
// но сам TimeExecutor остаётся без изменений.
// ============================================================================

import { log, logInfo } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export class TimeExecutor {
  private waitTimer: number | null = null;

  // --------------------------------------------------------------------------
  // WAIT – приостановить выполнение на 1 секунду (с учётом множителя скорости)
  // --------------------------------------------------------------------------
  public async executeWait(speedMultiplier: number): Promise<'wait'> {
    const delayMs = 1000 / speedMultiplier;
    log('TimeExecutor', 'executeWait', `Waiting for ${delayMs}ms (speed multiplier: ${speedMultiplier})`);

    await new Promise<void>((resolve) => {
      this.waitTimer = window.setTimeout(() => {
        this.waitTimer = null;
        resolve();
      }, delayMs);
    });

    return 'wait';
  }

  // --------------------------------------------------------------------------
  // TIME_SLOW – замедлить время (множитель скорости 0.5)
  // --------------------------------------------------------------------------
  public setSlow(): void {
    logInfo('TimeExecutor', 'setSlow', 'Time slowed down (speed multiplier: 0.5)');
    eventBus.emit('TIME_SLOW', { multiplier: 0.5 });
  }

  // --------------------------------------------------------------------------
  // TIME_FAST – ускорить время (множитель скорости 2)
  // --------------------------------------------------------------------------
  public setFast(): void {
    logInfo('TimeExecutor', 'setFast', 'Time sped up (speed multiplier: 2)');
    eventBus.emit('TIME_FAST', { multiplier: 2 });
  }

  // --------------------------------------------------------------------------
  // Очистить таймер (при остановке выполнения)
  // --------------------------------------------------------------------------
  public clearTimer(): void {
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
  }
}
