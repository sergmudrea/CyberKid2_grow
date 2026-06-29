// src/managers/AssetManager.ts
// ============================================================================
// МЕНЕДЖЕР АССЕТОВ — ЗАГРУЗКА ИЗ public/ С ФОЛБЭКОМ НА РИСОВАННЫЕ СПРАЙТЫ
// ============================================================================
// Идея:
//  - Для каждой текстуры известны: ключ, путь в public/ и функция-рисовальщик
//    (лёгкий процедурный спрайт на canvas).
//  - В Preload мы пытаемся загрузить PNG из public/. Если файл есть — он
//    используется. Если файла нет (loaderror) — генерируется рисованный спрайт.
//  - Это гарантирует, что текстура с нужным ключом существует ВСЕГДА,
//    независимо от того, загрузил ли художник реальный ассет.
// ============================================================================
// ВАЖНО: каждый фолбэк рисуется на ОТДЕЛЬНОМ canvas. Если переиспользовать
// один canvas, Phaser сохранит ссылку на «живой» холст и все текстуры покажут
// последний нарисованный кадр (типичный баг addCanvas).
// ============================================================================

import { TileType } from '../types/index';

export type DrawFn = (ctx: CanvasRenderingContext2D, size: number) => void;

export interface AssetDef {
  key: string;
  /** Путь в public/ (без него — только рисованный фолбэк). */
  path?: string;
  /** Рисовальщик лёгкого процедурного спрайта (фолбэк). */
  draw: DrawFn;
}

export const TILE_SIZE = 64;

// ----------------------------------------------------------------------------
// Базовые помощники рисования
// ----------------------------------------------------------------------------
function fillBg(ctx: CanvasRenderingContext2D, size: number, color: string, stroke = '#00000033'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

function drawGlyph(ctx: CanvasRenderingContext2D, size: number, glyph: string, color = '#ffffff'): void {
  ctx.fillStyle = color;
  ctx.font = `${Math.floor(size * 0.5)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.04);
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Лёгкий генератор «плитка + глиф»
function tile(color: string, glyph: string, glyphColor = '#ffffff'): DrawFn {
  return (ctx, size) => {
    fillBg(ctx, size, color);
    drawGlyph(ctx, size, glyph, glyphColor);
  };
}

// ----------------------------------------------------------------------------
// Рисованный танк (корпус + башня со стрелкой направления)
// ----------------------------------------------------------------------------
function drawTank(dir: 'up' | 'down' | 'left' | 'right' | 'idle'): DrawFn {
  const angle: Record<string, number> = { up: 0, right: 90, down: 180, left: 270, idle: 0 };
  return (ctx, size) => {
    const s = size;
    // прозрачный фон
    ctx.clearRect(0, 0, s, s);
    // корпус
    ctx.fillStyle = '#2e8b8b';
    ctx.strokeStyle = '#0c3a3a';
    ctx.lineWidth = 2;
    const m = s * 0.14;
    ctx.fillRect(m, m, s - 2 * m, s - 2 * m);
    ctx.strokeRect(m, m, s - 2 * m, s - 2 * m);
    // гусеницы
    ctx.fillStyle = '#1c2b2b';
    ctx.fillRect(m * 0.4, m, m * 0.6, s - 2 * m);
    ctx.fillRect(s - m - m * 0.6, m, m * 0.6, s - 2 * m);
    // башня
    circle(ctx, s / 2, s / 2, s * 0.18, '#00d6c0');
    // ствол / стрелка направления
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate((angle[dir] * Math.PI) / 180);
    ctx.fillStyle = '#063a35';
    ctx.fillRect(-s * 0.04, -s * 0.42, s * 0.08, s * 0.3);
    ctx.restore();
  };
}

// Рисованный монстр (тело + глаза + признак типа)
function drawMonster(body: string, accent: string, glyph?: string): DrawFn {
  return (ctx, size) => {
    const s = size;
    ctx.clearRect(0, 0, s, s);
    // тело
    circle(ctx, s / 2, s / 2, s * 0.34, body);
    // «зубчатый» низ
    ctx.fillStyle = body;
    for (let i = 0; i < 4; i++) {
      const x = s * 0.22 + i * s * 0.18;
      ctx.beginPath();
      ctx.arc(x, s * 0.72, s * 0.07, 0, Math.PI);
      ctx.fill();
    }
    // глаза
    circle(ctx, s * 0.4, s * 0.46, s * 0.08, '#ffffff');
    circle(ctx, s * 0.6, s * 0.46, s * 0.08, '#ffffff');
    circle(ctx, s * 0.4, s * 0.46, s * 0.04, '#111');
    circle(ctx, s * 0.6, s * 0.46, s * 0.04, '#111');
    // акцент типа
    ctx.fillStyle = accent;
    ctx.fillRect(s * 0.1, s * 0.1, s * 0.18, s * 0.12);
    if (glyph) drawGlyph(ctx, s, glyph, accent);
  };
}

// ----------------------------------------------------------------------------
// РЕЕСТР АССЕТОВ
// ----------------------------------------------------------------------------
export const ASSET_DEFS: AssetDef[] = [
  // --- Тайлы ---
  { key: 'tile_platform', path: '/assets/tiles/platform.png', draw: tile('#8B5A2B', '·', '#caa') },
  { key: 'tile_wall', path: '/assets/tiles/wall.png', draw: (c, s) => { fillBg(c, s, '#555'); c.strokeStyle = '#333'; c.lineWidth = 2; c.strokeRect(s*0.1, s*0.3, s*0.35, s*0.2); c.strokeRect(s*0.55, s*0.3, s*0.35, s*0.2); c.strokeRect(s*0.1, s*0.55, s*0.35, s*0.2); c.strokeRect(s*0.55, s*0.55, s*0.35, s*0.2); } },
  { key: 'tile_hole', path: '/assets/tiles/hole.png', draw: (c, s) => { fillBg(c, s, '#11131a'); circle(c, s/2, s/2, s*0.32, '#000'); } },
  { key: 'tile_coin', path: '/assets/tiles/coin.png', draw: (c, s) => { fillBg(c, s, '#2d2d3a'); circle(c, s/2, s/2, s*0.3, '#FFD700'); circle(c, s/2, s/2, s*0.2, '#FFC107'); drawGlyph(c, s, '$', '#8a6d00'); } },
  { key: 'tile_start', path: '/assets/tiles/start.png', draw: tile('#0a5', '▶') },
  // Доп. тайлы — реальных PNG нет, только фолбэк
  { key: 'tile_key', draw: tile('#ffaa00', '🔑') },
  { key: 'tile_door_locked', draw: tile('#8B0000', '🔒') },
  { key: 'tile_door_unlocked', draw: tile('#228B22', '🔓') },
  { key: 'tile_lava', draw: (c, s) => { fillBg(c, s, '#ff4500'); circle(c, s*0.35, s*0.6, s*0.08, '#ffd000'); circle(c, s*0.6, s*0.45, s*0.06, '#ffd000'); } },
  { key: 'tile_water', draw: tile('#1E90FF', '≈', '#cdeeff') },
  { key: 'tile_brick', draw: tile('#A52A2A', '▦') },
  { key: 'tile_gem', draw: (c, s) => { fillBg(c, s, '#2d2d3a'); c.fillStyle = '#00ffcc'; c.beginPath(); c.moveTo(s/2, s*0.2); c.lineTo(s*0.78, s*0.5); c.lineTo(s/2, s*0.8); c.lineTo(s*0.22, s*0.5); c.closePath(); c.fill(); } },
  { key: 'tile_magnet', draw: (c, s) => { fillBg(c, s, '#C0C0C0'); c.fillStyle = '#d11'; c.fillRect(s*0.28, s*0.25, s*0.16, s*0.4); c.fillStyle = '#33f'; c.fillRect(s*0.56, s*0.25, s*0.16, s*0.4); } },
  { key: 'tile_slow_field', draw: tile('#88AACC', '◷', '#103') },
  { key: 'tile_teleport', draw: tile('#9932CC', '◉', '#f0d0ff') },
  { key: 'tile_conveyor', draw: tile('#666', '»') },
  { key: 'tile_spring', draw: tile('#ff6600', '⇡') },
  { key: 'tile_button', draw: (c, s) => { fillBg(c, s, '#2d2d3a'); circle(c, s/2, s/2, s*0.28, '#DC143C'); } },
  { key: 'tile_lever', draw: tile('#D2691E', '⌐') },
  { key: 'tile_timer', draw: tile('#FFD700', '◷', '#5a4a00') },
  { key: 'tile_sensor', draw: tile('#00CED1', '⦿', '#024') },
  { key: 'tile_sorter', draw: tile('#4B0082', '☰') },
  { key: 'tile_black_box', draw: tile('#2F4F4F', '?', '#9ff') },
  { key: 'tile_cage', draw: tile('#cd7f32', '#') },
  { key: 'tile_trap', draw: tile('#8b4513', '!', '#ffd') },
  { key: 'tile_glue', draw: tile('#88cc88', '∴', '#063') },
  { key: 'tile_fake_wall', draw: (c, s) => { fillBg(c, s, '#5a5a5a'); c.globalAlpha = 0.5; drawGlyph(c, s, '?', '#fff'); c.globalAlpha = 1; } },

  // --- Игрок (танк) ---
  { key: 'player', path: '/assets/player/player.png', draw: drawTank('idle') },
  { key: 'player_up', path: '/assets/player/player_up.png', draw: drawTank('up') },
  { key: 'player_down', path: '/assets/player/player_down.png', draw: drawTank('down') },
  { key: 'player_left', path: '/assets/player/player_left.png', draw: drawTank('left') },
  { key: 'player_right', path: '/assets/player/player_right.png', draw: drawTank('right') },

  // --- Монстры ---
  { key: 'monster_patrol', path: '/assets/monsters/monster_patrol.png', draw: drawMonster('#8B008B', '#ff66ff') },
  { key: 'monster_chase', path: '/assets/monsters/monster_chase.png', draw: drawMonster('#DC143C', '#ffd400', '⚡') },
  { key: 'monster_tameable', path: '/assets/monsters/monster_tameable.png', draw: drawMonster('#228B22', '#a0ffa0', '♥') },
  { key: 'monster_phased', draw: drawMonster('#5566aa', '#cce') },
  { key: 'monster_zombie', draw: drawMonster('#6b8e23', '#3a5') },
  { key: 'monster_boss', draw: drawMonster('#7a0000', '#ffcc00', '★') },

  // --- UI кнопки ---
  { key: 'ui_button_run', path: '/assets/UI/button_run.png', draw: tile('#00AA44', '▶') },
  { key: 'ui_button_clear', path: '/assets/UI/button_clear.png', draw: tile('#AA4444', '✕') },
  { key: 'ui_button_save', path: '/assets/UI/button_save.png', draw: tile('#4444AA', '⬇') },
  { key: 'ui_button_load', path: '/assets/UI/button_load.png', draw: tile('#AA8844', '⬆') },

  // --- Эффекты ---
  { key: 'effect_teleport', path: '/assets/effects/teleport.png', draw: tile('#9932CC', '◉', '#f0d0ff') },
  { key: 'effect_death', path: '/assets/effects/death.png', draw: tile('#000', '✕', '#f44') },
  { key: 'effect_victory', path: '/assets/effects/victory.png', draw: tile('#0a5', '★', '#ffd700') },

  // --- Предметы инвентаря (только фолбэк) ---
  { key: 'item_key', draw: tile('#ffaa00', '🔑') },
  { key: 'item_corn', draw: tile('#2a5a2a', '🌽') },
  { key: 'item_core', draw: tile('#2d2d3a', '💎') },
  { key: 'item_drill', draw: tile('#666', '🔧') },
  { key: 'item_hook', draw: tile('#666', '🪝') },
  { key: 'item_wing', draw: tile('#88c', '🪽') },
  { key: 'item_bait', draw: tile('#36c', '🐟') },
  { key: 'item_gem', draw: tile('#2d2d3a', '💎') },
];

// ----------------------------------------------------------------------------
// Маппинг TileType -> ключ текстуры
// ----------------------------------------------------------------------------
export function tileTextureKey(tile: TileType): string {
  switch (tile) {
    case TileType.PLATFORM: return 'tile_platform';
    case TileType.WALL: return 'tile_wall';
    case TileType.HOLE: return 'tile_hole';
    case TileType.GOAL: return 'tile_coin';
    case TileType.START: return 'tile_start';
    case TileType.KEY: return 'tile_key';
    case TileType.DOOR_LOCKED: return 'tile_door_locked';
    case TileType.DOOR_UNLOCKED: return 'tile_door_unlocked';
    case TileType.CONVEYOR_UP:
    case TileType.CONVEYOR_DOWN:
    case TileType.CONVEYOR_LEFT:
    case TileType.CONVEYOR_RIGHT: return 'tile_conveyor';
    case TileType.SPRING: return 'tile_spring';
    case TileType.TELEPORT_IN:
    case TileType.TELEPORT_OUT: return 'tile_teleport';
    case TileType.LAVA: return 'tile_lava';
    case TileType.WATER: return 'tile_water';
    case TileType.GLUE: return 'tile_glue';
    case TileType.CAGE: return 'tile_cage';
    case TileType.TRAP: return 'tile_trap';
    case TileType.GEM: return 'tile_gem';
    case TileType.BRICK: return 'tile_brick';
    case TileType.BLACK_BOX: return 'tile_black_box';
    case TileType.BUTTON: return 'tile_button';
    case TileType.LEVER: return 'tile_lever';
    case TileType.TIMER: return 'tile_timer';
    case TileType.SENSOR: return 'tile_sensor';
    case TileType.SORTER: return 'tile_sorter';
    case TileType.MAGNET: return 'tile_magnet';
    case TileType.SLOW_FIELD: return 'tile_slow_field';
    case TileType.FAKE_WALL: return 'tile_fake_wall';
    default: return 'tile_platform';
  }
}

export function monsterTextureKey(type: string): string {
  switch (type) {
    case 'patrol': return 'monster_patrol';
    case 'chase': return 'monster_chase';
    case 'tameable': return 'monster_tameable';
    case 'phased': return 'monster_phased';
    case 'zombie': return 'monster_zombie';
    case 'boss': return 'monster_boss';
    default: return 'monster_patrol';
  }
}

export function itemTextureKey(id: string): string {
  if (id.startsWith('key') || id === 'cage_key') return 'item_key';
  if (id.startsWith('corn')) return 'item_corn';
  if (id.startsWith('core')) return 'item_core';
  if (id.startsWith('gem')) return 'item_gem';
  if (id === 'drill') return 'item_drill';
  if (id === 'hook') return 'item_hook';
  if (id === 'wing') return 'item_wing';
  if (id === 'bait') return 'item_bait';
  return 'item_core';
}

// ----------------------------------------------------------------------------
// Сгенерировать рисованный спрайт на ОТДЕЛЬНОМ canvas
// ----------------------------------------------------------------------------
export function generateFallbackCanvas(def: AssetDef, size = TILE_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  def.draw(ctx, size);
  return canvas;
}
