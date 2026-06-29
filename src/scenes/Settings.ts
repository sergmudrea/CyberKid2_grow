// src/scenes/Settings.ts
// ============================================================================
// СЦЕНА НАСТРОЕК (SETTINGS) – ПАТЧ 2.0
// ============================================================================
// - Отображает настройки: язык, звук, музыка, режим управления
// - Переключатель между классическим и раздельным управлением (Control Mode)
// - Кнопки сброса и экспорта/импорта (опционально)
// ============================================================================

import { Scene } from 'phaser';
import { settingsManager } from '../managers/SettingsManager';
import { ControlMode } from '../types/index';
import { logger } from '../core/Logger';

export class Settings extends Scene {
  private controlModeToggle: Phaser.GameObjects.Text;
  private soundToggle: Phaser.GameObjects.Text;
  private musicToggle: Phaser.GameObjects.Text;
  private langRu: Phaser.GameObjects.Text;
  private langEn: Phaser.GameObjects.Text;

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
    const title = this.add.text(width / 2, 50, 'SETTINGS', {
      fontSize: '32px',
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

    // --- РЕЖИМ УПРАВЛЕНИЯ (НОВОЕ В 2.0) ---
    const modeLabel = this.add.text(width / 2, 150, 'Control Mode:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const mode = settingsManager.getControlMode();
    const modeText = mode === ControlMode.SEPARATE ? '🔫 Separate (NEW)' : '🎮 Classic';
    this.controlModeToggle = this.add.text(width / 2, 190, modeText, {
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

    // Пояснение
    const modeDesc = this.add.text(width / 2, 220, 
      'Separate: turn turret and move independently\nClassic: old style (turn + move)', {
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5);

    // --- ЗВУК ---
    const soundLabel = this.add.text(width / 2, 270, 'Sound:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const soundEnabled = settingsManager.isSoundEnabled();
    this.soundToggle = this.add.text(width / 2, 310, soundEnabled ? '🔊 ON' : '🔇 OFF', {
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
    const musicLabel = this.add.text(width / 2, 370, 'Music:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const musicEnabled = settingsManager.isMusicEnabled();
    this.musicToggle = this.add.text(width / 2, 410, musicEnabled ? '🎵 ON' : '🎵 OFF', {
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
    const langLabel = this.add.text(width / 2, 480, 'Language:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const currentLang = settingsManager.getLanguage();
    this.langRu = this.add.text(width / 2 - 60, 520, 'Русский', {
      fontSize: '16px',
      color: currentLang === 'ru' ? '#00ffcc' : '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    this.langRu.on('pointerdown', () => {
      settingsManager.setLanguage('ru');
      this.updateLanguageDisplay();
    });
    this.langEn = this.add.text(width / 2 + 60, 520, 'English', {
      fontSize: '16px',
      color: currentLang === 'en' ? '#00ffcc' : '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 12, y: 6 },
    }).setInteractive({ useHandCursor: true });
    this.langEn.on('pointerdown', () => {
      settingsManager.setLanguage('en');
      this.updateLanguageDisplay();
    });

    // Кнопка RESET ALL SETTINGS
    const resetBtn = this.add.text(width / 2, 580, '🔄 RESET ALL', {
      fontSize: '14px',
      color: '#ffaa44',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setInteractive({ useHandCursor: true });
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
    this.updateControlModeDisplay();
    this.updateSoundDisplay();
    this.updateMusicDisplay();
    this.updateLanguageDisplay();
  }
}
