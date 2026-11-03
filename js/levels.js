'use strict';
/* Level layouts. Units are game pixels; the road surface is at y = 240.
   ground:      [startX, endX] solid road segments — the gaps between them are potholes
   platforms:   [x, topY, width, type]   type: glass | crate | awning | flyover | metro | pillar
   movers:      [x, type, range, speed]  BMTC buses / autos you can ride (roof only)
   enemies:     [x, type, patrolRange, surfaceY = 240]
   chai:        [x, y] centre of the cup
   checkpoints: [x, clipId, signName]
   mushroom:    x of the experience mushroom on the road (eating it makes Ekta grow)
   gate:        [x, name] the building Ekta walks into to finish the level
   Names, taglines, experience and gate names here are fallbacks; the live text comes from the content database. */
const LEVELS = [
  {
    key: 'intel', theme: 'intel', music: 'intel', width: 2100,
    name: 'Intel Campus', tagline: 'Where I learned to automate the boring stuff', experience: 'Automation + MLOps',
    ground: [[0, 600], [648, 1250], [1300, 2100]],
    platforms: [
      [260, 200, 64, 'glass'], [400, 168, 64, 'glass'],
      [800, 200, 64, 'glass'], [930, 168, 64, 'glass'], [1060, 136, 64, 'glass'],
      [1450, 200, 64, 'crate'], [1580, 168, 80, 'glass'],
    ],
    enemies: [[470, 'null', 50], [1000, 'null', 50], [1620, 'crash', 30, 168], [1850, 'merge', 50]],
    chai: [[150, 222], [190, 222], [292, 184], [432, 152], [464, 152], [624, 196], [832, 184], [962, 152],
      [1350, 222], [1482, 184], [1612, 152], [1652, 152], [1950, 222]],
    helmet: [1380, 222], comma: [1092, 116],
    checkpoints: [[1180, '02', 'Intel Junction']],
    mushroom: 1780,
    gate: [2000, 'INTEL'],
  },
  {
    key: 'zeta', theme: 'zeta', music: 'zeta', width: 2700,
    name: 'Zeta Tech Park', tagline: 'Shipping to 20 million people', experience: 'Shipping to 20M users',
    ground: [[0, 700], [760, 1500], [1560, 2700]],
    movers: [[250, 'bus', 180, 45], [1580, 'bus', 150, 50]],
    platforms: [
      [560, 168, 64, 'awning'],
      [900, 200, 64, 'crate'], [1020, 168, 64, 'glass'],
      [1300, 200, 64, 'awning'],
      [1900, 184, 48, 'crate'], [1980, 144, 48, 'glass'], [2060, 104, 80, 'awning'],
    ],
    enemies: [[180, 'null', 50], [620, 'crash', 40], [1100, 'merge', 50], [1400, 'null', 50], [2200, 'crash', 40]],
    chai: [[120, 222], [160, 222], [330, 180], [390, 180], [592, 152], [730, 200], [932, 184], [1332, 184],
      [1924, 168], [2500, 222], [2540, 222]],
    helmet: [1052, 150], comma: [2004, 124],
    checkpoints: [[1180, '03', 'Zeta Flyover'], [2420, '04', 'Things I Build']],
    mushroom: 2330,
    gate: [2600, 'ZETA'],
  },
  {
    key: 'kora', theme: 'kora', music: 'kora', width: 2100,
    name: 'Creative Lane', tagline: "The side of me that doesn't need a job title", experience: 'Creativity: poetry + videos',
    ground: [[0, 800], [850, 2100]],
    platforms: [
      [240, 200, 64, 'awning'], [380, 168, 64, 'awning'],
      [600, 200, 64, 'crate'],
      [1000, 200, 64, 'awning'], [1130, 168, 64, 'awning'], [1260, 136, 64, 'awning'],
      [1600, 200, 64, 'awning'],
    ],
    enemies: [[700, 'null', 50], [1450, 'merge', 50]],
    chai: [[100, 222], [140, 222], [272, 184], [412, 152], [444, 152], [632, 184], [825, 190], [1032, 184], [1162, 152],
      [1632, 184], [1700, 222], [1740, 222]],
    helmet: [920, 222], comma: [1292, 118],
    checkpoints: [[1820, '05', 'The Studio']],
    mushroom: 1540,
    gate: [2000, 'STUDIO'],
  },
  {
    key: 'silk', theme: 'silk', music: 'silk', width: 3000,
    name: 'Rush Hour', tagline: 'The last stretch', experience: '',
    ground: [[0, 520], [580, 1000], [1060, 2000], [2060, 2500], [2560, 3000]],
    movers: [[620, 'auto', 150, 50], [2100, 'auto', 150, 55]],
    platforms: [
      [380, 196, 64, 'crate'], [460, 160, 64, 'metro'],
      [820, 168, 96, 'flyover'],
      [1150, 168, 64, 'pillar'], [1260, 136, 80, 'metro'],
      [1750, 168, 96, 'flyover'],
      [2300, 168, 64, 'pillar'],
      [2650, 196, 64, 'crate'],
    ],
    enemies: [[300, 'null', 60], [900, 'crash', 40], [1182, 'flaky', 26, 168], [1650, 'crash', 50], [1798, 'flaky', 36, 168],
      [2332, 'flaky', 24, 168], [2820, 'merge', 40]],
    chai: [[200, 222], [412, 180], [492, 144], [860, 152], [1450, 222], [1500, 222], [1550, 222],
      [2030, 200], [2200, 222], [2682, 180], [2860, 222]],
    jamCars: [[1110, 'white'], [1920, 'blue'], [2750, 'yellow']],
    helmet: [1600, 222], comma: [1320, 116],
    mushroom: 2420,
    finish: 2930,
  },
];
