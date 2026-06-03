// tools/generator/test.ts
// ============================================================================
// ТЕСТ ГЕНЕРАТОРА И BFS-ВАЛИДАТОРА (ПАТЧ 2.0)
// ============================================================================
// Запуск: npx tsx tools/generator/test.ts
// ============================================================================

import { LevelGenerator, GenerationRequest, ControlMode } from './levelGenerator';
import { InventoryAwareBFS } from './pathfinder';

async function testGeneratorAndBFS() {
  console.log('=== ТЕСТ ГЕНЕРАТОРА И BFS ===\n');

  // 1. Создаём генератор с фиксированным seed для воспроизводимости
  const gen = new LevelGenerator(12345);

  // 2. Запрос на генерацию уровня (патч 2.0)
  const req: GenerationRequest = {
    stage: 3,
    theme: 'volcano',
    difficulty: 40,
    allowBackdoors: true,
    backdoorCount: 2,
    controlMode: ControlMode.SEPARATE,
    magnetsEnabled: true,
    slowFieldsEnabled: true,
  };

  console.log('Генерация уровня с параметрами:', req);
  const level = gen.generate(req);
  console.log('Уровень сгенерирован, ID:', level.id);
  console.log('Режим управления:', level.controlMode);
  console.log('Начальный угол башни:', level.startTurretAngle);
  console.log('Размер поля:', level.size.width, 'x', level.size.height);
  console.log('Магниты:', level.objects.magnets?.length || 0);
  console.log('Замедляющие поля:', level.objects.slowFields?.length || 0);
  console.log('Количество предметов:', level.objects.items?.length || 0);
  console.log('Доступные команды:', level.availableCommands.length);
  console.log('Оптимальные шаги (подсказка):', level.solutionHints.optimalSteps);

  // 3. BFS-валидация
  const tiles = level.tiles;
  const items = level.objects.items || [];
  const monsters = level.objects.monsters || [];
  const teleports = level.objects.teleports || [];
  const conveyors = level.objects.conveyors || [];
  const springs = level.objects.springs || [];
  const mechanisms = [
    ...(level.objects.buttons || []),
    ...(level.objects.levers || []),
    ...(level.objects.timers || []),
    ...(level.objects.sensors || []),
    ...(level.objects.sorters || []),
  ];
  const bridges = level.objects.bridges || [];
  const cages = level.objects.cages || [];
  const traps = level.objects.traps || [];
  const magnets = level.objects.magnets || [];
  const slowFields = level.objects.slowFields || [];

  const bfs = new InventoryAwareBFS(
    tiles, items, monsters, teleports, conveyors, springs,
    mechanisms, bridges, cages, traps, magnets, slowFields,
    { maxDepth: 1000, maxPaths: 5, allowBackdoors: true, debug: true }
  );

  const startPos = { x: level.start.x, y: level.start.y };
  const goalPos = { x: level.goal.x, y: level.goal.y };
  const startDir = level.start.direction;
  const startTurretAngle = level.startTurretAngle;

  console.log('\nЗапуск BFS поиска путей...');
  const paths = bfs.findPaths(startPos, goalPos, startDir, startTurretAngle);

  if (paths.length === 0) {
    console.error('❌ BFS не нашёл ни одного пути! Уровень нерешаем.');
    process.exit(1);
  } else {
    console.log(`✅ Найдено путей: ${paths.length}`);
    paths.forEach((p, i) => {
      console.log(`  Путь ${i+1}: шагов=${p.steps}, бэкдоров=${p.usedBackdoors.join(',') || 'нет'}`);
    });
  }

  // 4. Дополнительная проверка: есть ли путь без бэкдоров?
  const normalPaths = paths.filter(p => !p.isBackdoor);
  if (normalPaths.length === 0) {
    console.warn('⚠️ Нет простого пути (без бэкдоров). Уровень может быть слишком сложным.');
  } else {
    console.log(`✅ Есть простой путь (${normalPaths[0].steps} шагов).`);
  }

  console.log('\n=== ТЕСТ ПРОЙДЕН УСПЕШНО ===');
}

testGeneratorAndBFS().catch(console.error);
