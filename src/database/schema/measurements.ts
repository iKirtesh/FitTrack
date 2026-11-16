import { index, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt, pk } from './common';

export const bodyMeasurements = sqliteTable(
  'body_measurements',
  {
    id: pk(),
    date: text('date').notNull(),
    weightKg: real('weight_kg'),
    bodyFatPct: real('body_fat_pct'),
    chestCm: real('chest_cm'),
    waistCm: real('waist_cm'),
    hipsCm: real('hips_cm'),
    armsCm: real('arms_cm'),
    forearmsCm: real('forearms_cm'),
    thighsCm: real('thighs_cm'),
    calvesCm: real('calves_cm'),
    neckCm: real('neck_cm'),
    photoUri: text('photo_uri'),
    notes: text('notes'),
    importHash: text('import_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('bm_date_idx').on(t.date), uniqueIndex('bm_import_hash_uq').on(t.importHash)],
);
