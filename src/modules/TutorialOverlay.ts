// src/modules/TutorialOverlay.ts
// ============================================================================
// ОБУЧАЮЩИЙ ОВЕРЛЕЙ (Tutorial) — адаптивный по режиму обучения (Research.md)
// ============================================================================
// Presence управляется LearningProfile.tutorial:
//   forced   (Kiddo/Scholar)  — показывается всегда при старте уровня
//   optional (Dev Student)    — показывается один раз (флаг в localStorage)
//   off      (Developer)      — не показывается
//
// Шрифт масштабируется fontScale, текст — подробностью режима.
// ============================================================================

import Phaser from 'phaser';
import { LearningMode } from '../types/index';
import { getLearningProfile, scaleFontSize, MODE_TITLE } from '../config/learningProfile';
import { logger } from '../core/Logger';

const SEEN_KEY = 'cyberkid_tutorial_seen';

// Тексты туториала по режимам (краткие для terse, подробные для detailed)
const TUTORIAL_TEXT: Record<LearningMode, string[]> = {
  kiddo: [
    'Привет! 👋',
    'Нажимай на кнопки команд,',
    'чтобы собрать программу.',
    'Потом жми ▶ RUN!',
  ],
  scholar: [
    'Как играть:',
    '1. Выбирай команды кнопками слева — они добавляются в программу справа.',
    '2. Башню нужно повернуть в сторону движения, затем двигаться вперёд.',
    '3. Доберись до 💰, избегая стен и ям.',
    '4. Нажми ▶ RUN, чтобы запустить программу.',
  ],
  dev_student: [
    'Программирование робота:',
    '• Команды складываются в последовательность (программу).',
    '• turn_left()/turn_right() поворачивают башню, move_forward() двигает.',
    '• Меньше шагов = больше звёзд. Цель — оптимальное решение.',
    '• RUN исполняет программу; CLEAR очищает.',
  ],
  developer: [], // off — не используется
};

export class TutorialOverlay {
  private scene: Phaser.Scene;
  private learningMode: LearningMode;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, learningMode: LearningMode) {
    this.scene = scene;
    this.learningMode = learningMode;
  }

  /**
   * Показать туториал, если этого требует режим обучения.
   * Возвращает true, если оверлей был показан.
   */
  maybeShow(): boolean {
    const profile = getLearningProfile(this.learningMode);

    if (profile.tutorial === 'off') {
      logger.debug('TutorialOverlay', 'maybeShow', `skipped (off, mode=${this.learningMode})`);
      return false;
    }

    if (profile.tutorial === 'optional') {
      // Показываем только один раз
      try {
        if (localStorage.getItem(SEEN_KEY) === '1') {
          logger.debug('TutorialOverlay', 'maybeShow', 'optional already seen');
          return false;
        }
      } catch (_e) { /* localStorage недоступен — покажем */ }
    }

    this.show(profile.fontScale);
    return true;
  }

  private show(fontScale: number): void {
    const { width, height } = this.scene.cameras.main;
    const lines = TUTORIAL_TEXT[this.learningMode];
    if (!lines || lines.length === 0) return;

    this.container = this.scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    // Затемнение фона
    const dim = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.72)
      .setOrigin(0, 0)
      .setInteractive(); // блокирует клики под собой
    this.container.add(dim);

    // Панель
    const panelW = Math.min(width - 60, Math.round(560 * fontScale));
    const panelH = Math.round((140 + lines.length * 30) * fontScale);
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x141432, 1);
    panel.fillRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(2, 0x00ffcc, 1);
    panel.strokeRoundedRect(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 14);
    this.container.add(panel);

    // Заголовок (режим)
    const title = this.scene.add.text(width / 2, height / 2 - panelH / 2 + 26,
      `📖 ${MODE_TITLE[this.learningMode]}`, {
      fontSize: scaleFontSize('20px', fontScale),
      color: '#00ffcc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(title);

    // Текст
    const body = this.scene.add.text(width / 2, height / 2 - panelH / 2 + 58, lines.join('\n'), {
      fontSize: scaleFontSize('15px', fontScale),
      color: '#ffffff',
      align: this.learningMode === 'kiddo' ? 'center' : 'left',
      lineSpacing: 6,
      wordWrap: { width: panelW - 50 },
    }).setOrigin(0.5, 0);
    this.container.add(body);

    // Кнопка «Понятно»
    const btn = this.scene.add.text(width / 2, height / 2 + panelH / 2 - 30, '✅ Понятно!', {
      fontSize: scaleFontSize('16px', fontScale),
      color: '#0a0a2a',
      backgroundColor: '#00ffcc',
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.dismiss());
    this.container.add(btn);

    // Появление
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });

    logger.info('TutorialOverlay', 'show', `mode=${this.learningMode}`);
  }

  private dismiss(): void {
    // Запоминаем показ для optional-режима
    const profile = getLearningProfile(this.learningMode);
    if (profile.tutorial === 'optional') {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (_e) { /* ignore */ }
    }
    const c = this.container;
    this.container = null;
    if (!c) return;
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: 200,
      onComplete: () => c.destroy(),
    });
  }
}
