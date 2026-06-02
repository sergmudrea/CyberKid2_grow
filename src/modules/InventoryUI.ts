// src/modules/InventoryUI.ts
// ============================================================================
// ИНТЕРФЕЙС ИНВЕНТАРЯ (UI)
// ============================================================================
// Отображает содержимое инвентаря игрока в виде всплывающего окна.
// Показывает ключи, количество кукурузы, ядер, а также наличие инструментов.
// ============================================================================
// - Кнопка рюкзака (🎒) для открытия/закрытия окна
// - Окно отображается в правом нижнем углу
// - Обновляется при изменении инвентаря через событие INVENTORY_CHANGED
// ============================================================================

import { Scene } from 'phaser';
import { Inventory } from '../types/index';
import { logger } from '../core/Logger';

export class InventoryUI {
  private scene: Scene;
  private container: HTMLDivElement;
  private inventory: Inventory;
  private isOpen: boolean = false;
  private backpackButton: HTMLButtonElement;
  private backpackWindow: HTMLDivElement;

  constructor(scene: Scene, initialInventory: Inventory) {
    this.scene = scene;
    this.inventory = initialInventory;
    this.createUI();
  }

  // --------------------------------------------------------------------------
  // СОЗДАНИЕ DOM-ЭЛЕМЕНТОВ
  // --------------------------------------------------------------------------
  private createUI(): void {
    // Контейнер для всего UI инвентаря (кнопка + окно)
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.bottom = '20px';
    this.container.style.right = '20px';   // расположение в правом нижнем углу
    this.container.style.zIndex = '1000';
    document.body.appendChild(this.container);

    // Кнопка-рюкзак (открыть/закрыть окно)
    this.backpackButton = document.createElement('button');
    this.backpackButton.textContent = '🎒';
    this.backpackButton.style.width = '48px';
    this.backpackButton.style.height = '48px';
    this.backpackButton.style.fontSize = '24px';
    this.backpackButton.style.backgroundColor = '#2a2a4a';
    this.backpackButton.style.color = 'white';
    this.backpackButton.style.border = '2px solid #00ffcc';
    this.backpackButton.style.borderRadius = '8px';
    this.backpackButton.style.cursor = 'pointer';
    this.backpackButton.onclick = () => this.toggleBackpack();
    this.container.appendChild(this.backpackButton);

    // Окно инвентаря (скрыто по умолчанию)
    this.backpackWindow = document.createElement('div');
    this.backpackWindow.style.position = 'absolute';
    this.backpackWindow.style.bottom = '60px';
    this.backpackWindow.style.right = '0px';
    this.backpackWindow.style.width = '250px';
    this.backpackWindow.style.backgroundColor = 'rgba(0,0,0,0.95)';
    this.backpackWindow.style.border = '2px solid #00ffcc';
    this.backpackWindow.style.borderRadius = '12px';
    this.backpackWindow.style.padding = '10px';
    this.backpackWindow.style.display = 'none';
    this.backpackWindow.style.flexDirection = 'column';
    this.backpackWindow.style.gap = '8px';
    this.backpackWindow.style.fontFamily = 'monospace';
    this.container.appendChild(this.backpackWindow);

    this.renderBackpack();
  }

  private toggleBackpack(): void {
    this.isOpen = !this.isOpen;
    this.backpackWindow.style.display = this.isOpen ? 'flex' : 'none';
  }

  // --------------------------------------------------------------------------
  // ОБНОВЛЕНИЕ ИНВЕНТАРЯ И ПЕРЕРИСОВКА
  // --------------------------------------------------------------------------
  public updateInventory(inventory: Inventory): void {
    this.inventory = inventory;
    this.renderBackpack();
  }

  private renderBackpack(): void {
    this.backpackWindow.innerHTML = '';

    // Заголовок
    const title = document.createElement('div');
    title.textContent = '🎒 INVENTORY 🎒';
    title.style.color = '#ffcc00';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    this.backpackWindow.appendChild(title);

    // Ключи
    const keysSection = this.createSection('🔑 KEYS', this.inventory.keys.length, this.inventory.keys.join(', '));
    this.backpackWindow.appendChild(keysSection);

    // Кукуруза
    const cornSection = this.createSection('🌽 CORN', this.inventory.corn);
    this.backpackWindow.appendChild(cornSection);

    // Ядра
    const coresSection = this.createSection('💎 CORES', this.inventory.cores);
    this.backpackWindow.appendChild(coresSection);

    // Инструменты
    const tools = [];
    if (this.inventory.hasDrill) tools.push('🔧 Drill');
    if (this.inventory.hasHook) tools.push('🪝 Hook');
    if (this.inventory.hasWing) tools.push('🪽 Wing');
    if (this.inventory.hasBait) tools.push('🐟 Bait');

    const toolsSection = this.createSection('🛠️ TOOLS', tools.length, tools.join(', '));
    this.backpackWindow.appendChild(toolsSection);

    // Общее количество предметов
    const total = this.inventory.keys.length + this.inventory.corn + this.inventory.cores + tools.length;
    const totalSection = this.createSection('📦 TOTAL', total);
    this.backpackWindow.appendChild(totalSection);
  }

  private createSection(label: string, value: number, details: string = ''): HTMLDivElement {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.justifyContent = 'space-between';
    section.style.alignItems = 'center';
    section.style.padding = '5px 8px';
    section.style.backgroundColor = '#1e1e2e';
    section.style.borderRadius = '6px';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.color = '#aaaaff';
    labelSpan.style.fontSize = '12px';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value.toString();
    valueSpan.style.color = '#ffcc00';
    valueSpan.style.fontSize = '14px';
    valueSpan.style.fontWeight = 'bold';

    section.appendChild(labelSpan);
    section.appendChild(valueSpan);

    if (details && details.length > 0) {
      const detailSpan = document.createElement('div');
      detailSpan.textContent = details;
      detailSpan.style.fontSize = '10px';
      detailSpan.style.color = '#888888';
      detailSpan.style.marginTop = '2px';
      detailSpan.style.gridColumn = 'span 2';
      section.style.flexWrap = 'wrap';
      section.appendChild(detailSpan);
    }

    return section;
  }

  public destroy(): void {
    if (this.container) this.container.remove();
  }
}
