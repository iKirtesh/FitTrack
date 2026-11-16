/** MET values from the Compendium of Physical Activities (rounded). Used only for *estimates*. */
export const RUN_ACTIVITIES = [
  { id: 'outdoor_run', label: 'Outdoor run', gps: true, met: 9.8 },
  { id: 'indoor_run', label: 'Indoor run', gps: false, met: 9.0 },
  { id: 'walk', label: 'Walk', gps: false, met: 3.5 },
  { id: 'outdoor_walk', label: 'Outdoor walk', gps: true, met: 3.8 },
  { id: 'treadmill', label: 'Treadmill', gps: false, met: 8.3 },
  { id: 'hike', label: 'Hike', gps: true, met: 6.0 },
] as const;
export type RunActivityId = (typeof RUN_ACTIVITIES)[number]['id'];

export const CARDIO_ACTIVITIES = [
  { id: 'cycling', label: 'Cycling', met: 7.5 },
  { id: 'stationary_cycling', label: 'Stationary cycling', met: 6.8 },
  { id: 'swimming', label: 'Swimming', met: 7.0 },
  { id: 'rowing', label: 'Rowing', met: 7.0 },
  { id: 'elliptical', label: 'Elliptical', met: 5.0 },
  { id: 'stair_climber', label: 'Stair climber', met: 8.8 },
  { id: 'jump_rope', label: 'Jump rope', met: 11.8 },
  { id: 'hiit', label: 'HIIT', met: 8.0 },
  { id: 'treadmill', label: 'Treadmill', met: 8.3 },
  { id: 'sports', label: 'Sports', met: 7.0 },
  { id: 'custom', label: 'Custom', met: 6.0 },
] as const;
export type CardioActivityId = (typeof CARDIO_ACTIVITIES)[number]['id'];

export const INTENSITY = ['low', 'moderate', 'high'] as const;
export type Intensity = (typeof INTENSITY)[number];
/** Multiplier applied to the base MET so intensity changes the estimate. */
export const INTENSITY_FACTOR: Record<Intensity, number> = { low: 0.8, moderate: 1, high: 1.2 };

/** Strength training MET for calorie estimates when no better data exists. */
export const STRENGTH_MET = 5.0;
