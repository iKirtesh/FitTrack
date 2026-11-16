import { bmi, bmiCategory, caloriesFromMet, estimateOneRepMax, goalProgress, setVolumeKg, totalVolumeKg } from './calculations';
import { addPoint, computeSplits, emptyTrack, fastestFullSplit, haversineM, paceSecPerKm, summariseTrack } from './running';
import { csvField, toCsv } from '@/utils/csv';
import { formatPace, formatDuration, kgToDisplay, displayToKg } from '@/utils/units';
import { addDays, startOfWeek, ageFromDob, isValidDay } from '@/utils/dates';

describe('workout calculations', () => {
  it('computes volume and ignores warm-ups and unchecked sets', () => {
    const sets = [
      { weightKg: 20, reps: 12, isCompleted: true },
      { weightKg: 30, reps: 10, isCompleted: true },
      { weightKg: 40, reps: 8, isCompleted: true },
      { weightKg: 100, reps: 5, isCompleted: false },
      { weightKg: 20, reps: 10, isCompleted: true, kind: 'warmup' },
    ];
    expect(totalVolumeKg(sets, 'weight_reps')).toBe(240 + 300 + 320);
  });
  it('assisted volume uses bodyweight minus assistance and needs bodyweight', () => {
    expect(setVolumeKg({ weightKg: 20, reps: 5, isCompleted: true }, 'assisted', 80)).toBe(300);
    expect(setVolumeKg({ weightKg: 20, reps: 5, isCompleted: true }, 'assisted', null)).toBe(0);
  });
  it('estimates 1RM only in a meaningful rep range', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimateOneRepMax(100, 20)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
  it('BMI and categories', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
    expect(bmi(80, 0)).toBeNull();
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(24.9)).toBe('normal');
    expect(bmiCategory(27)).toBe('overweight');
    expect(bmiCategory(31)).toBe('obese');
  });
  it('calorie estimate scales with weight, time and intensity', () => {
    expect(caloriesFromMet(8, 70, 3600)).toBe(560);
    expect(caloriesFromMet(8, 70, 1800)).toBe(280);
    expect(caloriesFromMet(8, 70, 3600, 'high')).toBeGreaterThan(560);
    expect(caloriesFromMet(8, 0, 3600)).toBe(0);
  });
  it('goal progress works for loss and gain and clamps', () => {
    expect(goalProgress(90, 85, 80)).toBe(0.5);
    expect(goalProgress(60, 65, 70)).toBe(0.5);
    expect(goalProgress(90, 95, 80)).toBe(0);
    expect(goalProgress(90, 70, 80)).toBe(1);
  });
});

describe('running and GPS', () => {
  const pt = (lat: number, lon: number, t: number, acc = 5, alt: number | null = null) => ({ latitude: lat, longitude: lon, recordedAt: t, accuracyM: acc, altitudeM: alt });
  it('haversine is about 111 km per degree of latitude', () => {
    expect(haversineM(pt(0, 0, 0), pt(1, 0, 0))).toBeGreaterThan(110_000);
    expect(haversineM(pt(0, 0, 0), pt(1, 0, 0))).toBeLessThan(112_000);
  });
  it('pace is null with no distance rather than invented', () => {
    expect(paceSecPerKm(0, 600)).toBeNull();
    expect(paceSecPerKm(5000, 1500)).toBe(300);
  });
  it('rejects inaccurate fixes and impossible jumps', () => {
    let st = emptyTrack();
    st = addPoint(st, pt(0, 0, 0));
    st = addPoint(st, pt(0.0001, 0, 10_000, 80)); // bad accuracy
    st = addPoint(st, pt(1, 0, 11_000)); // ~111 km in 1 s
    expect(st.distanceM).toBe(0);
    expect(st.rejected).toBe(2);
    st = addPoint(st, pt(0.0001, 0, 12_000));
    expect(st.distanceM).toBeGreaterThan(10);
  });
  it('elevation gain ignores sub-metre noise', () => {
    let st = emptyTrack();
    st = addPoint(st, pt(0, 0, 0, 5, 100));
    st = addPoint(st, pt(0.0001, 0, 5000, 5, 100.5));
    st = addPoint(st, pt(0.0002, 0, 10_000, 5, 103.5));
    expect(st.elevationGainM).toBeCloseTo(3.0, 5);
  });
  it('builds interpolated km splits and keeps a meaningful partial', () => {
    // 3.5 km at constant 5:00/km
    const samples = Array.from({ length: 8 }, (_, i) => ({ distanceM: i * 500, elapsedSec: i * 150 }));
    const splits = computeSplits(samples);
    expect(splits).toHaveLength(4);
    expect(splits[0]!.paceSecPerKm).toBeCloseTo(300, 5);
    expect(splits[3]!.distanceM).toBeCloseTo(500, 5);
    expect(fastestFullSplit(splits)!.splitIndex).toBe(1);
  });
  it('drops a trailing sliver under 100 m', () => {
    expect(computeSplits([{ distanceM: 0, elapsedSec: 0 }, { distanceM: 1050, elapsedSec: 315 }])).toHaveLength(1);
  });
  it('excludes paused time from elapsed time in the summary', () => {
    const pts = [pt(0, 0, 0), pt(0.009, 0, 300_000), pt(0.018, 0, 900_000)];
    const withPause = summariseTrack(pts, 0, [{ from: 300_000, to: 600_000 }]);
    const last = withPause.samples[withPause.samples.length - 1]!;
    expect(last.elapsedSec).toBe(600);
  });
});

describe('utilities', () => {
  it('csv escapes quotes/newlines and neutralises formulas', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField(-5)).toBe('-5');
    expect(csvField(null)).toBe('');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
  it('formats pace, duration and converts units', () => {
    expect(formatPace(330, 'km')).toBe('5:30 /km');
    expect(formatPace(null, 'km')).toBe('-');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(displayToKg(kgToDisplay(80, 'lb'), 'lb')).toBeCloseTo(80, 6);
  });
  it('date helpers use local days', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // Sunday -> previous Monday
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(ageFromDob('2000-06-15', new Date(2026, 5, 14).getTime())).toBe(25);
  });
});
