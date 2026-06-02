#!/usr/bin/env node
// tools/generator/index.ts
// ============================================================================
// CLI ДЛЯ ГЕНЕРАТОРА УРОВНЕЙ (LEVEL GENERATOR COMMAND LINE INTERFACE)
// ============================================================================
// Назначение:
// - Генерировать уровни для заданного мира и количества
// - Поддерживает seed, сложность, бэкдоры, разрешённые команды
// - Сохраняет уровни в папку public/levels/ (или указанную)
// - Обновляет manifest.json после генерации
// ============================================================================
// Использование:
//   npm run generate:levels -- --world meadow --count 500 --difficulty 1-100
//   npm run generate:levels -- --world ocean --start 501 --count 500 --seed 42
//   npm run generate:levels -- --world bonus --count 3000 --backdoors --backdoorCount 2
// ============================================================================

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { LevelGenerator, GenerationRequest, BackdoorType } from './levelGenerator';

// ----------------------------------------------------------------------------
// НАСТРОЙКИ ПО УМОЛЧАНИЮ
// ----------------------------------------------------------------------------
const DEFAULT_OUTPUT_DIR = './public/levels';
const DEFAULT_MANIFEST_PATH = './public/levels/manifest.json';

// Миры и их диапазоны ID
const WORLD_CONFIG: Record<string, { idStart: number; defaultCount: number; defaultStage: 1|2|3|4 }> = {
  meadow:   { idStart: 1,    defaultCount: 500, defaultStage: 1 },
  ocean:    { idStart: 501,  defaultCount: 500, defaultStage: 2 },
  clouds:   { idStart: 1001, defaultCount: 500, defaultStage: 3 },
  fairy:    { idStart: 1501, defaultCount: 500, defaultStage: 3 },
  volcano:  { idStart: 2001, defaultCount: 500, defaultStage: 4 },
  arcade:   { idStart: 3001, defaultCount: 0,   defaultStage: 4 }, // arcade – пользовательские уровни, генерируются только по запросу
  bonus:    { idStart: 5001, defaultCount: 3000, defaultStage: 4 },
};

// ----------------------------------------------------------------------------
// ПРОГРАММА
// ----------------------------------------------------------------------------
const program = new Command();

program
  .name('generate:levels')
  .description('Генерирует уровни для CyberKid: Танкист')
  .version('1.0.0');

program
  .command('run')
  .description('Запуск генерации уровней')
  .option('-w, --world <world>', 'Мир (meadow, ocean, clouds, fairy, volcano, arcade, bonus)', 'meadow')
  .option('-c, --count <number>', 'Количество уровней для генерации', parseInt)
  .option('-s, --start <number>', 'Начальный номер уровня (ID)', parseInt)
  .option('-d, --difficulty <range>', 'Диапазон сложности (1-100 или min-max, например 1-20)', '1-100')
  .option('--seed <number>', 'Seed для воспроизводимости', parseInt)
  .option('--stage <number>', 'Этап обучения (1-4)', parseInt)
  .option('--backdoors', 'Разрешить генерацию бэкдоров', false)
  .option('--backdoorCount <number>', 'Количество бэкдоров на уровень (1-3)', parseInt)
  .option('--output <path>', 'Папка для сохранения уровней', DEFAULT_OUTPUT_DIR)
  .option('--no-manifest', 'Не обновлять manifest.json', false)
  .action(async (options) => {
    const world = options.world;
    const count = options.count ?? WORLD_CONFIG[world]?.defaultCount;
    if (!count) {
      console.error(`❌ Мир ${world} не имеет количества по умолчанию. Укажите --count.`);
      process.exit(1);
    }
    
    const startId = options.start ?? WORLD_CONFIG[world]?.idStart;
    if (!startId) {
      console.error(`❌ Мир ${world} не имеет стартового ID. Укажите --start.`);
      process.exit(1);
    }
    
    const difficultyRange = options.difficulty.split('-').map(Number);
    const minDiff = difficultyRange[0];
    const maxDiff = difficultyRange[1] || minDiff;
    
    const stage = options.stage ?? WORLD_CONFIG[world]?.defaultStage ?? 1;
    const allowBackdoors = options.backdoors === true;
    const backdoorCount = options.backdoorCount ?? (allowBackdoors ? 2 : 0);
    
    const outputDir = path.resolve(options.output);
    const manifestPath = path.resolve(options.manifest === false ? '/dev/null' : (options.manifest || DEFAULT_MANIFEST_PATH));
    
    console.log(`🚀 Генерация уровней для мира ${world}`);
    console.log(`   ID: от ${startId} до ${startId + count - 1}`);
    console.log(`   Сложность: ${minDiff}–${maxDiff}`);
    console.log(`   Stage: ${stage}`);
    console.log(`   Бэкдоры: ${allowBackdoors ? `да (${backdoorCount} шт.)` : 'нет'}`);
    console.log(`   Папка: ${outputDir}`);
    
    // Убедимся, что папка существует
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const generator = new LevelGenerator(options.seed);
    const generatedIds: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const levelNum = startId + i;
      const difficulty = Math.floor(minDiff + (i / count) * (maxDiff - minDiff));
      
      const req: GenerationRequest = {
        stage: stage as 1|2|3|4,
        theme: world,
        difficulty,
        allowBackdoors,
        backdoorCount: allowBackdoors ? backdoorCount : 0,
        seed: options.seed ? options.seed + i : undefined,
      };
      
      console.log(`   Генерация уровня ${levelNum} (сложность ${difficulty})...`);
      const level = generator.generate(req);
      level.id = `${world}_${levelNum.toString().padStart(3,'0')}`;
      level.name = `${world.charAt(0).toUpperCase() + world.slice(1)} ${levelNum}`;
      
      const filename = `${level.id}.json`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(level, null, 2), 'utf-8');
      generatedIds.push(level.id);
      
      // Прогресс
      if ((i+1) % 50 === 0) {
        console.log(`      Сгенерировано ${i+1} из ${count}`);
      }
    }
    
    console.log(`✅ Сгенерировано ${count} уровней.`);
    
    // Обновление manifest.json
    if (options.manifest !== false) {
      let existingManifest: string[] = [];
      if (fs.existsSync(manifestPath)) {
        existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      }
      // Добавляем только новые ID
      const newIds = generatedIds.filter(id => !existingManifest.includes(id));
      if (newIds.length) {
        existingManifest.push(...newIds);
        fs.writeFileSync(manifestPath, JSON.stringify(existingManifest, null, 2), 'utf-8');
        console.log(`📄 Обновлён manifest.json (добавлено ${newIds.length} уровней).`);
      } else {
        console.log(`📄 manifest.json уже содержит все сгенерированные уровни.`);
      }
    }
  });

program.parse(process.argv);
