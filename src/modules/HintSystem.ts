// src/modules/HintSystem.ts
// ============================================================================
// СИСТЕМА ПОДСКАЗОК ДЛЯ ИГРОВОЙ СЦЕНЫ
// ============================================================================
// Таймеры подсказок:
//  15s  — «Подумай ещё»
//  30s  — направление к цели (стрелка/текст)
//  60s  — подсказка по механике
//  90s  — подробнее о механике уровня
// 120s  — первые 3 шага решения
// ============================================================================

import Phaser from 'phaser';
import { Point } from '../types/index';
import { Pathfinder } from './Pathfinder';
import { logger } from '../core/Logger';

export class HintSystem {
  private scene: Phaser.Scene;
  private getPlayerPos: () => Point;
  private pathfinder: Pathfinder;

  private timers: Phaser.Time.TimerEvent[] = [];
  private hintText: Phaser.GameObjects.Text | null = null;
  private active: boolean = false;

  constructor(
    scene: Phaser.Scene,
    getPlayerPos: () => Point,
    pathfinder: Pathfinder
  ) {
    this.scene = scene;
    this.getPlayerPos = getPlayerPos;
    this.pathfinder = pathfinder;
  }

  /** Запустить таймеры подсказок */
  start(): void {
    this.clearTimers();
    this.active = true;

    // 15s — первый толчок
    this.timers.push(
      this.scene.time.delayedCall(15000, () => {
        if (this.active) this.showHint('Подумай ещё... Ты близко!', 3000);
      })
    );

    // 30s — направление
    this.timers.push(
      this.scene.time.delayedCall(30000, () => {
        if (!this.active) return;
        const pos = this.getPlayerPos();
        const hint = this.pathfinder.getHint(pos);
        if (hint) {
          const arrow = { up: '↑', down: '↓', left: '←', right: '→' }[hint.dir] || '?';
          this.showHint(`Следующий шаг: ${arrow} ${hint.text}`, 4000);
        } else {
          this.showHint('Ты уже у цели?', 3000);
        }
      })
    );

    // 60s — механика
    this.timers.push(
      this.scene.time.delayedCall(60000, () => {
        if (this.active) {
          this.showHint('Попробуй сначала развернуть башню в нужную сторону', 5000);
        }
      })
    );

    // 90s — подробнее
    this.timers.push(
      this.scene.time.delayedCall(90000, () => {
        if (this.active) {
          this.showHint('Используй TURN_LEFT / TURN_RIGHT для поворота, затем MOVE_FORWARD', 6000);
        }
      })
    );

    // 120s — первые 3 команды
    this.timers.push(
      this.scene.time.delayedCall(120000, () => {
        if (!this.active) return;
        // Используем SEPARATE — более универсальный
        const solution = this.pathfinder.findCommandSolution(
          (this.pathfinder as any).level?.controlMode || 'separate'
        );
        if (solution && solution.length > 0) {
          const first3 = solution.slice(0, 3).join(', ');
          this.showHint(`Первые шаги: ${first3}`, 7000);
        } else {
          this.showHint('Решение не найдено автоматически, думай!', 4000);
        }
      })
    );

    logger.debug('HintSystem', 'start', 'Hint timers started');
  }

  /** Сбросить таймеры (при действии игрока) */
  reset(): void {
    this.clearTimers();
    this.hideHint();
    if (this.active) {
      this.start();
    }
    logger.debug('HintSystem', 'reset', 'Hint timers reset');
  }

  stop(): void {
    this.active = false;
    this.clearTimers();
    this.hideHint();
  }

  destroy(): void {
    this.stop();
    this.hintText?.destroy();
    this.hintText = null;
  }

  private clearTimers(): void {
    for (const timer of this.timers) {
      timer.destroy();
    }
    this.timers = [];
  }

  private showHint(text: string, duration: number = 4000): void {
    this.hideHint();
    const width = this.scene.cameras.main.width;
    this.hintText = this.scene.add.text(
      width / 2,
      50,
      `💡 ${text}`,
      {
        fontSize: '16px',
        color: '#ffdd88',
        backgroundColor: '#0008',
        padding: { x: 14, y: 8 },
        wordWrap: { width: 400 },
        align: 'center',
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(300)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: this.hintText,
      alpha: 1,
      duration: 300,
    });

    this.scene.time.delayedCall(duration, () => {
      this.hideHint();
    });

    logger.info('HintSystem', 'showHint', text);
  }

  private hideHint(): void {
    if (this.hintText) {
      const txt = this.hintText;
      this.hintText = null;
      this.scene.tweens.add({
        targets: txt,
        alpha: 0,
        duration: 300,
        onComplete: () => txt.destroy(),
      });
    }
  }
}
