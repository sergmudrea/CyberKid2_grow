// src/config/learningProfile.ts
// ============================================================================
// ПРОФИЛИ РЕЖИМОВ ОБУЧЕНИЯ (Adaptive UI из Research.md)
// ============================================================================
// Каждый режим обучения влияет на:
//  - command panel appearance      → CommandPanel (уже реализовано)
//  - hint system verbosity         → detailed / terse + тайминги
//  - tutorial presence             → forced / optional / off
//  - font size and contrast        → fontScale (крупнее для Kiddo)
//
// Этот модуль — единый источник правды для всех адаптивных параметров.
// ============================================================================

import { LearningMode } from '../types/index';

/** Подробность подсказок */
export type HintVerbosity = 'terse' | 'detailed';

/** Режим показа туториала */
export type TutorialPresence = 'forced' | 'optional' | 'off';

export interface LearningProfile {
  /** Подробность текста подсказок */
  hintVerbosity: HintVerbosity;
  /** Множитель задержек таймеров подсказок (меньше = подсказки появляются раньше) */
  hintDelayFactor: number;
  /** Показывать ли подсказку с фрагментом синтаксиса (Python) */
  hintShowCode: boolean;
  /** Режим туториала */
  tutorial: TutorialPresence;
  /** Масштаб шрифта интерфейса (1.0 = базовый) */
  fontScale: number;
}

// ----------------------------------------------------------------------------
// Таблица профилей по Research.md «The Four Learning Modes» / «Adaptive UI»
// ----------------------------------------------------------------------------
//
//  Kiddo (3–5):       подсказки краткие и ранние, туториал принудительный,
//                     крупный шрифт (large touch targets).
//  Scholar (6–9):     подробные пошаговые подсказки, туториал принудительный,
//                     слегка увеличенный шрифт.
//  Dev Student (10–14): подробные подсказки + сниппеты кода, туториал по желанию.
//  Developer (15+):   краткие подсказки, без туториала, компактный шрифт.
// ----------------------------------------------------------------------------
const PROFILES: Record<LearningMode, LearningProfile> = {
  kiddo: {
    hintVerbosity: 'terse',
    hintDelayFactor: 0.6,   // подсказки появляются заметно раньше
    hintShowCode: false,
    tutorial: 'forced',
    fontScale: 1.4,
  },
  scholar: {
    hintVerbosity: 'detailed',
    hintDelayFactor: 1.0,
    hintShowCode: false,
    tutorial: 'forced',
    fontScale: 1.1,
  },
  dev_student: {
    hintVerbosity: 'detailed',
    hintDelayFactor: 1.0,
    hintShowCode: true,     // показываем фрагменты Python
    tutorial: 'optional',
    fontScale: 1.0,
  },
  developer: {
    hintVerbosity: 'terse',
    hintDelayFactor: 1.6,   // подсказки появляются поздно (минимум помощи)
    hintShowCode: true,
    tutorial: 'off',
    fontScale: 0.95,
  },
};

/** Получить профиль адаптивного UI для режима обучения */
export function getLearningProfile(mode: LearningMode): LearningProfile {
  return PROFILES[mode] || PROFILES.scholar;
}

/**
 * Масштабировать строку размера шрифта Phaser ('16px') по fontScale.
 * Возвращает новую строку '<n>px' с округлением до целого.
 */
export function scaleFontSize(base: string, fontScale: number): string {
  const n = parseInt(base, 10);
  if (isNaN(n)) return base;
  return `${Math.round(n * fontScale)}px`;
}

/** Короткое человекочитаемое описание режима (для туториала/настроек) */
export const MODE_TITLE: Record<LearningMode, string> = {
  kiddo: 'Kiddo (3–5)',
  scholar: 'Scholar (6–9)',
  dev_student: 'Dev Student (10–14)',
  developer: 'Developer (15+)',
};
