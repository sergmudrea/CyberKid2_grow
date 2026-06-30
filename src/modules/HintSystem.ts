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
import { Point, LearningMode } from '../types/index';
import { Pathfinder } from './Pathfinder';
import { logger } from '../core/Logger';
import { getLearningProfile, scaleFontSize, LearningProfile } from '../config/learningProfile';

export class HintSystem {
  private scene: Phaser.Scene;
  private getPlayerPos: () => Point;
  private pathfinder: Pathfinder;

  private timers: Phaser.Time.TimerEvent[] = [];
  private hintText: Phaser.GameObjects.Text | null = null;
  private active: boolean = false;

  // Режим обучения управляет подробностью и таймингами подсказок
  private learningMode: LearningMode = 'scholar';
  private profile: LearningProfile = getLearningProfile('scholar');

  constructor(
    scene: Phaser.Scene,
    getPlayerPos: () => Point,
    pathfinder: Pathfinder,
    learningMode: LearningMode = 'scholar'
  ) {
    this.scene = scene;
    this.getPlayerPos = getPlayerPos;
    this.pathfinder = pathfinder;
    this.setLearningMode(learningMode);
  }

  /** Установить режим обучения (влияет на подробность и тайминги) */
  setLearningMode(mode: LearningMode): void {
    this.learningMode = mode;
    this.profile = getLearningProfile(mode);
    // Если таймеры уже идут — перезапустить с новыми задержками
    if (this.active) {
      this.clearTimers();
      this.scheduleTimers();
    }
  }

  /** Применить множитель задержки режима к базовому таймингу (мс) */
  private delay(baseMs: number): number {
    return Math.round(baseMs * this.profile.hintDelayFactor);
  }

  /** Запустить таймеры подсказок */
  start(): void {
    this.clearTimers();
    this.active = true;
    this.scheduleTimers();
    logger.debug('HintSystem', 'start', `Hint timers started (mode=${this.learningMode})`);
  }

  /**
   * Запланировать таймеры подсказок с учётом режима обучения.
   * Тайминги масштабируются hintDelayFactor, тексты — подробностью (terse/detailed).
   */
  private scheduleTimers(): void {
    const detailed = this.profile.hintVerbosity === 'detailed';

    // 15s — первый толчок
    this.timers.push(
      this.scene.time.delayedCall(this.delay(15000), () => {
        if (!this.active) return;
        this.showHint(detailed ? 'Подумай ещё... Ты совсем близко!' : 'Думай!', 3000);
      })
    );

    // 30s — направление
    this.timers.push(
      this.scene.time.delayedCall(this.delay(30000), () => {
        if (!this.active) return;
        const pos = this.getPlayerPos();
        const hint = this.pathfinder.getHint(pos);
        if (hint) {
          const arrow = { up: '↑', down: '↓', left: '←', right: '→' }[hint.dir] || '?';
          // Kiddo / terse: только стрелка; detailed: стрелка + пояснение
          this.showHint(detailed ? `Следующий шаг: ${arrow} ${hint.text}` : arrow, 4000);
        } else {
          this.showHint(detailed ? 'Кажется, ты уже у цели?' : '🎯', 3000);
        }
      })
    );

    // 60s — механика
    this.timers.push(
      this.scene.time.delayedCall(this.delay(60000), () => {
        if (!this.active) return;
        this.showHint(
          detailed
            ? 'Попробуй сначала развернуть башню в нужную сторону, затем двигаться'
            : 'Поверни башню → двигайся',
          5000
        );
      })
    );

    // 90s — подробнее (с фрагментом кода для dev_student/developer)
    this.timers.push(
      this.scene.time.delayedCall(this.delay(90000), () => {
        if (!this.active) return;
        if (this.profile.hintShowCode) {
          this.showHint('turn_left() / turn_right(), затем move_forward()', 6000);
        } else if (detailed) {
          this.showHint('Используй TURN_LEFT / TURN_RIGHT для поворота, затем MOVE_FORWARD', 6000);
        } else {
          this.showHint('Поворот, потом вперёд', 5000);
        }
      })
    );

    // 120s — первые шаги решения (3 для terse, 5 для detailed)
    this.timers.push(
      this.scene.time.delayedCall(this.delay(120000), () => {
        if (!this.active) return;
        const solution = this.pathfinder.findCommandSolution(
          (this.pathfinder as any).level?.controlMode || 'separate'
        );
        if (solution && solution.length > 0) {
          const n = detailed ? 5 : 3;
          const firstN = solution.slice(0, n).join(', ');
          this.showHint(detailed ? `Первые шаги: ${firstN}` : firstN, 7000);
        } else {
          this.showHint(detailed ? 'Решение не найдено автоматически — думай сам!' : 'Думай!', 4000);
        }
      })
    );
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
    const fs = this.profile.fontScale;
    this.hintText = this.scene.add.text(
      width / 2,
      50,
      `💡 ${text}`,
      {
        fontSize: scaleFontSize('16px', fs),
        color: '#ffdd88',
        backgroundColor: '#0008',
        padding: { x: 14, y: 8 },
        wordWrap: { width: Math.round(400 * fs) },
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
