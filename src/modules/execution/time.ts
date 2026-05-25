// src/modules/execution/time.ts
// Команды управления временем: TIME_SLOW, TIME_FAST, WAIT

import { log, logInfo } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export class TimeExecutor {
  private waitTimer: number | null = null;

  /**
   * WAIT — приостановить выполнение на 1 секунду (с учётом множителя скорости)
   */
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

  /**
   * TIME_SLOW — замедлить время (множитель скорости 0.5)
   * Обрабатывается в раннере (runner.ts)
   */
  public setSlow(): void {
    logInfo('TimeExecutor', 'setSlow', 'Time slowed down (speed multiplier: 0.5)');
    eventBus.emit('TIME_SLOW', { multiplier: 0.5 });
  }

  /**
   * TIME_FAST — ускорить время (множитель скорости 2)
   * Обрабатывается в раннере (runner.ts)
   */
  public setFast(): void {
    logInfo('TimeExecutor', 'setFast', 'Time sped up (speed multiplier: 2)');
    eventBus.emit('TIME_FAST', { multiplier: 2 });
  }

  public clearTimer(): void {
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
  }
}
