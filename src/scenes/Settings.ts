// src/scenes/Settings.ts
// ============================================================================
// СЦЕНА НАСТРОЕК (SETTINGS) – ПАТЧ 2.0
// ============================================================================
// - Отображает настройки: режим обучения, язык, звук, музыка, режим управления
// - Режим обучения (Kiddo/Scholar/Dev Student/Developer) из Research.md
// - Переключатель между классическим и раздельным управлением (Control Mode)
// - Кнопка сброса
// ============================================================================

import { Scene } from 'phaser';
import { settingsManager } from '../managers/SettingsManager';
import { ControlMode, LearningMode } from '../types/index';
import { logger } from '../core/Logger';

interface LearnModeOption {
  mode: LearningMode;
  label: string;
  age: string;
}

export class Settings extends Scene {
  private controlModeToggle!: Phaser.GameObjects.Text;
  private soundToggle!: Phaser.GameObjects.Text;
  private musicToggle!: Phaser.GameObjects.Text;
  private langRu!: Phaser.GameObjects.Text;
  private langEn!: Phaser.GameObjects.Text;

  private learnButtons: Map<LearningMode, Phaser.GameObjects.Text> = new Map();
  private learnDesc!: Phaser.GameObjects.Text;

  private readonly learnOptions: LearnModeOption[] = [
    { mode: 'kiddo', label: '🧒 Kiddo', age: '3–5' },
    { mode: 'scholar', label: '📘 Scholar', age: '6–9' },
    { mode: 'dev_student', label: '💻 Dev Student', age: '10–14' },
    { mode: 'developer', label: '⚡ Developer', age: '15+' },
  ];

  private readonly learnDescriptions: Record<LearningMode, string> = {
    kiddo: 'Kiddo (3–5): только иконки на кнопках, без текста',
    scholar: 'Scholar (6–9): иконки + текстовые подписи команд',
    dev_student: 'Dev Student (10–14): подписи + синтаксис Python',
    developer: 'Developer (15+): только синтаксис, Script Mode',
  };

  constructor() {
    super('Settings');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Заголовок
    this.add.text(width / 2, 36, 'SETTINGS', {
      fontSize: '30px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      stroke: '#0066ff',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Кнопка BACK
    const backButton = this.add.text(10, 10, '← BACK', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenu');
    });

    // --- РЕЖИМ ОБУЧЕНИЯ (Research.md) ---
    this.add.text(width / 2, 80, 'Learning Mode:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const current = settingsManager.getLearningMode();
    const btnY = 118;
    const totalW = width - 40;
    const cellW = totalW / this.learnOptions.length;
    this.learnOptions.forEach((opt, i) => {
      const x = 20 + cellW * i + cellW / 2;
      const btn = this.add.text(x, btnY, opt.label, {
        fontSize: '15px',
        color: opt.mode === current ? '#0a0a2a' : '#ffffff',
        backgroundColor: opt.mode === current ? '#00ffcc' : '#2a2a4a',
        padding: { x: 8, y: 6 },
        align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        settingsManager.setLearningMode(opt.mode);
        this.updateLearningModeDisplay();
        logger.info('Settings', 'learningMode set', opt.mode);
      });
      this.learnButtons.set(opt.mode, btn);
    });

    this.learnDesc = this.add.text(width / 2, 150, this.learnDescriptions[current], {
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5);

    // --- РЕЖИМ УПРАВЛЕНИЯ (2.0) ---
    this.add.text(width / 2, 200, 'Control Mode:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const mode = settingsManager.getControlMode();
    const modeText = mode === ControlMode.SEPARATE ? '🔫 Separate (NEW)' : '🎮 Classic';
    this.controlModeToggle = this.add.text(width / 2, 236, modeText, {
      fontSize: '18px',
      color: '#ffcc00',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.controlModeToggle.on('pointerdown', () => {
      settingsManager.toggleControlMode();
      this.updateControlModeDisplay();
      logger.info('Settings', 'controlMode toggled', settingsManager.getControlMode());
    });

    this.add.text(width / 2, 268,
      'Separate: turn turret and move independently · Classic: turn + move', {
      fontSize: '11px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5);

    // --- ЗВУК ---
    this.add.text(width / 2 - 90, 320, 'Sound:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const soundEnabled = settingsManager.isSoundEnabled();
    this.soundToggle = this.add.text(width / 2 + 50, 320, soundEnabled ? '🔊 ON' : '🔇 OFF', {
      fontSize: '18px',
      color: '#ffcc00',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.soundToggle.on('pointerdown', () => {
      settingsManager.setSoundEnabled(!settingsManager.isSoundEnabled());
      this.updateSoundDisplay();
    });

    // --- МУЗЫКА ---
    this.add.text(width / 2 - 90, 375, 'Music:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const musicEnabled = settingsManager.isMusicEnabled();
    this.musicToggle = this.add.text(width / 2 + 50, 375, musicEnabled ? '🎵 ON' : '🎵 OFF', {
      fontSize: '18px',
      color: '#ffcc00',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.musicToggle.on('pointerdown', () => {
      settingsManager.setMusicEnabled(!settingsManager.isMusicEnabled());
      this.updateMusicDisplay();
    });

    // --- ЯЗЫК ---
    this.add.text(width / 2, 440, 'Language:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const currentLang = settingsManager.getLanguage();
    this.langRu = this.add.text(width / 2 - 60, 478, 'Русский', {
      fontSize: '16px',
      color: currentLang === 'ru' ? '#00ffcc' : '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.langRu.on('pointerdown', () => {
      settingsManager.setLanguage('ru');
      this.updateLanguageDisplay();
    });
    this.langEn = this.add.text(width / 2 + 60, 478, 'English', {
      fontSize: '16px',
      color: currentLang === 'en' ? '#00ffcc' : '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.langEn.on('pointerdown', () => {
      settingsManager.setLanguage('en');
      this.updateLanguageDisplay();
    });

    // Кнопка RESET ALL SETTINGS
    const resetBtn = this.add.text(width / 2, 540, '🔄 RESET ALL', {
      fontSize: '14px',
      color: '#ffaa44',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => {
      settingsManager.resetToDefaults();
      this.updateAllDisplays();
      logger.info('Settings', 'resetToDefaults', 'Settings reset to defaults');
    });

    // Подпись версии
    this.add.text(width - 20, height - 20, 'v2.0.0', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(1, 1);
  }

  private updateLearningModeDisplay(): void {
    const current = settingsManager.getLearningMode();
    this.learnButtons.forEach((btn, mode) => {
      const active = mode === current;
      btn.setColor(active ? '#0a0a2a' : '#ffffff');
      btn.setBackgroundColor(active ? '#00ffcc' : '#2a2a4a');
    });
    this.learnDesc.setText(this.learnDescriptions[current]);
  }

  private updateControlModeDisplay(): void {
    const mode = settingsManager.getControlMode();
    const modeText = mode === ControlMode.SEPARATE ? '🔫 Separate (NEW)' : '🎮 Classic';
    this.controlModeToggle.setText(modeText);
  }

  private updateSoundDisplay(): void {
    const enabled = settingsManager.isSoundEnabled();
    this.soundToggle.setText(enabled ? '🔊 ON' : '🔇 OFF');
  }

  private updateMusicDisplay(): void {
    const enabled = settingsManager.isMusicEnabled();
    this.musicToggle.setText(enabled ? '🎵 ON' : '🎵 OFF');
  }

  private updateLanguageDisplay(): void {
    const lang = settingsManager.getLanguage();
    this.langRu.setColor(lang === 'ru' ? '#00ffcc' : '#ffffff');
    this.langEn.setColor(lang === 'en' ? '#00ffcc' : '#ffffff');
  }

  private updateAllDisplays(): void {
    this.updateLearningModeDisplay();
    this.updateControlModeDisplay();
    this.updateSoundDisplay();
    this.updateMusicDisplay();
    this.updateLanguageDisplay();
  }
}
