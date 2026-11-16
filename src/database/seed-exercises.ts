import type { Difficulty, Equipment, ExerciseType, MuscleGroupId, TrackingType } from '@/constants/exercise';

export interface SeedExercise {
  key: string;
  name: string;
  muscle: MuscleGroupId;
  secondary?: MuscleGroupId[];
  equipment: Equipment;
  how: string;
  difficulty?: Difficulty;
  type?: ExerciseType;
  tracking?: TrackingType;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

type Opt = { tracking?: TrackingType; difficulty?: Difficulty; type?: ExerciseType };
const x = (
  name: string,
  muscle: MuscleGroupId,
  equipment: Equipment,
  secondary: MuscleGroupId[],
  how: string,
  opt: Opt = {},
): SeedExercise => ({
  key: slug(name),
  name,
  muscle,
  equipment,
  secondary,
  how,
  difficulty: opt.difficulty,
  type: opt.type,
  tracking: opt.tracking,
});
const bw: Opt = { tracking: 'bodyweight_reps' };
const timed: Opt = { tracking: 'timed' };
const easy: Opt = { difficulty: 'beginner' };
const hard: Opt = { difficulty: 'advanced' };
const bwEasy: Opt = { tracking: 'bodyweight_reps', difficulty: 'beginner' };
const bwHard: Opt = { tracking: 'bodyweight_reps', difficulty: 'advanced' };

/** Text-only library. Image/illustration support exists in the schema (`image_uri`) but no assets are bundled. */
export const EXERCISE_SEED: SeedExercise[] = [
  // Chest
  x('Barbell Bench Press', 'chest', 'barbell', ['triceps', 'shoulders'], 'Lie on a flat bench, grip slightly wider than shoulders, lower the bar to mid-chest under control, then press up until arms are straight.'),
  x('Incline Barbell Bench Press', 'chest', 'barbell', ['shoulders', 'triceps'], 'On a 30 degree incline bench, lower the bar to the upper chest and press back up without flaring the elbows.'),
  x('Dumbbell Bench Press', 'chest', 'dumbbells', ['triceps', 'shoulders'], 'Press dumbbells from chest level to full extension over the chest, lowering until upper arms are just below parallel.', easy),
  x('Incline Dumbbell Press', 'chest', 'dumbbells', ['shoulders', 'triceps'], 'On an incline bench, press the dumbbells up and slightly together, then lower to the sides of the upper chest.'),
  x('Dumbbell Fly', 'chest', 'dumbbells', [], 'With a slight elbow bend, open the arms wide until you feel a chest stretch, then bring the dumbbells back together over the chest.'),
  x('Cable Crossover', 'chest', 'cable', [], 'Set pulleys high, step forward and sweep the handles down and together in front of the hips with a soft elbow bend.'),
  x('Chest Press Machine', 'chest', 'machine', ['triceps'], 'Adjust the seat so handles are at mid-chest, press forward to full extension, return slowly.', easy),
  x('Pec Deck', 'chest', 'machine', [], 'With forearms on the pads, bring the arms together in front of the chest, pause, then return under control.', easy),
  x('Push-up', 'chest', 'bodyweight', ['triceps', 'shoulders', 'core'], 'Hands under shoulders, body in a straight line, lower the chest to the floor and press back up.', bwEasy),
  x('Decline Push-up', 'chest', 'bodyweight', ['shoulders', 'triceps'], 'Feet elevated on a bench, perform a push-up keeping the body rigid.', bw),
  x('Chest Dip', 'chest', 'bodyweight', ['triceps', 'shoulders'], 'On parallel bars lean forward, lower until the upper arms are parallel to the floor, then press up.', bwHard),
  x('Landmine Press', 'chest', 'barbell', ['shoulders', 'triceps'], 'Hold the end of an anchored barbell at the shoulder and press up and forward.'),
  // Back
  x('Deadlift', 'back', 'barbell', ['hamstrings', 'glutes', 'forearms'], 'Bar over mid-foot, hinge at the hips, flat back, drive through the floor and stand tall; lower by pushing the hips back.', hard),
  x('Pull-up', 'back', 'bodyweight', ['biceps', 'forearms'], 'From a dead hang with an overhand grip, pull until the chin passes the bar, then lower fully.', bwHard),
  x('Chin-up', 'back', 'bodyweight', ['biceps'], 'Underhand shoulder-width grip, pull the chin over the bar and lower under control.', bw),
  x('Assisted Pull-up', 'back', 'machine', ['biceps'], 'Select an assistance weight on the machine, then perform a pull-up. Less assistance is harder.', { tracking: 'assisted', difficulty: 'beginner' }),
  x('Lat Pulldown', 'back', 'cable', ['biceps'], 'Grip wide, lean back slightly, pull the bar to the upper chest by driving the elbows down.', easy),
  x('Close-grip Lat Pulldown', 'back', 'cable', ['biceps'], 'With a neutral close grip, pull the handle to the upper chest keeping the torso still.'),
  x('Barbell Row', 'back', 'barbell', ['biceps', 'hamstrings'], 'Hinge to about 45 degrees, pull the bar to the lower ribs, squeeze the shoulder blades, lower slowly.'),
  x('One-arm Dumbbell Row', 'back', 'dumbbells', ['biceps'], 'Knee and hand on a bench, pull the dumbbell to the hip keeping the back flat.', easy),
  x('Seated Cable Row', 'back', 'cable', ['biceps'], 'Sit tall, pull the handle to the stomach, squeeze the shoulder blades, extend arms under control.', easy),
  x('T-bar Row', 'back', 'barbell', ['biceps'], 'Straddle the bar, hinge forward and row the weight to the chest.'),
  x('Chest-supported Row', 'back', 'machine', ['biceps'], 'Chest on the pad, row the handles back focusing on shoulder blade retraction.', easy),
  x('Straight-arm Pulldown', 'back', 'cable', [], 'With straight arms, pull the bar from above the head down to the thighs using the lats.'),
  x('Back Extension', 'back', 'bodyweight', ['glutes', 'hamstrings'], 'On a hyperextension bench, hinge at the hips down and raise to a straight line.', bwEasy),
  x('Face Pull', 'back', 'cable', ['shoulders'], 'With a rope at face height, pull towards the face with elbows high, rotating the hands outward.', easy),
  x('Dumbbell Shrug', 'back', 'dumbbells', ['forearms'], 'Hold dumbbells at the sides and lift the shoulders straight up, pause, lower.', easy),
  x('Rack Pull', 'back', 'barbell', ['glutes', 'hamstrings'], 'Deadlift from pins set at knee height, locking out with the hips.', hard),
  // Shoulders
  x('Overhead Press', 'shoulders', 'barbell', ['triceps', 'core'], 'Bar at the collarbone, brace the core, press overhead until locked out, lower to the collarbone.'),
  x('Seated Dumbbell Press', 'shoulders', 'dumbbells', ['triceps'], 'Seated with back support, press the dumbbells overhead and lower to ear level.', easy),
  x('Arnold Press', 'shoulders', 'dumbbells', ['triceps'], 'Start with palms facing you, rotate the palms outward as you press overhead.'),
  x('Lateral Raise', 'shoulders', 'dumbbells', [], 'Raise the dumbbells out to the sides to shoulder height with a soft elbow bend, lower slowly.', easy),
  x('Cable Lateral Raise', 'shoulders', 'cable', [], 'Single-arm raise from a low pulley across the body to shoulder height.'),
  x('Front Raise', 'shoulders', 'dumbbells', [], 'Raise the dumbbells in front to shoulder height, lower with control.', easy),
  x('Rear Delt Fly', 'shoulders', 'dumbbells', ['back'], 'Hinge forward and raise the dumbbells out to the sides, squeezing the rear shoulders.'),
  x('Reverse Pec Deck', 'shoulders', 'machine', ['back'], 'Facing the pad, sweep the handles back and out to target the rear delts.', easy),
  x('Machine Shoulder Press', 'shoulders', 'machine', ['triceps'], 'Press the handles overhead from shoulder height keeping the back on the pad.', easy),
  x('Upright Row', 'shoulders', 'barbell', ['back'], 'Pull the bar up along the body to chest height leading with the elbows.'),
  x('Pike Push-up', 'shoulders', 'bodyweight', ['triceps'], 'In a downward-dog position, lower the head towards the floor and press back up.', bw),
  x('Kettlebell Press', 'shoulders', 'kettlebell', ['triceps', 'core'], 'Press a kettlebell from the rack position overhead with the wrist straight.'),
  // Biceps
  x('Barbell Curl', 'biceps', 'barbell', ['forearms'], 'Curl the bar from thighs to shoulders without swinging, lower slowly.', easy),
  x('Dumbbell Curl', 'biceps', 'dumbbells', ['forearms'], 'Alternate or together, curl the dumbbells while keeping the elbows pinned to the sides.', easy),
  x('Hammer Curl', 'biceps', 'dumbbells', ['forearms'], 'With palms facing in, curl the dumbbells up and lower under control.', easy),
  x('Incline Dumbbell Curl', 'biceps', 'dumbbells', [], 'Lie back on an incline bench, let the arms hang and curl for a deep stretch.'),
  x('Preacher Curl', 'biceps', 'barbell', [], 'With the upper arms on the pad, curl the bar up and lower to near full extension.'),
  x('Cable Curl', 'biceps', 'cable', [], 'Curl a straight or EZ bar from a low pulley, keeping constant tension.', easy),
  x('Concentration Curl', 'biceps', 'dumbbells', [], 'Seated, elbow against the inner thigh, curl one dumbbell at a time.'),
  x('Resistance Band Curl', 'biceps', 'resistance_band', [], 'Stand on the band and curl the handles to the shoulders.', easy),
  // Triceps
  x('Close-grip Bench Press', 'triceps', 'barbell', ['chest'], 'Grip about shoulder width and press with the elbows tucked close to the body.'),
  x('Triceps Pushdown', 'triceps', 'cable', [], 'Elbows at the sides, push the bar or rope down until the arms are straight, return slowly.', easy),
  x('Overhead Triceps Extension', 'triceps', 'dumbbells', [], 'Hold one dumbbell overhead with both hands, lower behind the head, extend back up.'),
  x('Skull Crusher', 'triceps', 'barbell', [], 'Lying on a bench, lower the bar towards the forehead by bending the elbows, then extend.'),
  x('Triceps Dip', 'triceps', 'bodyweight', ['chest', 'shoulders'], 'On bars or a bench, lower the body by bending the elbows to about 90 degrees and press up.', bw),
  x('Cable Overhead Extension', 'triceps', 'cable', [], 'Facing away from a high pulley, extend the arms forward and overhead.'),
  x('Diamond Push-up', 'triceps', 'bodyweight', ['chest'], 'Hands close together under the chest, lower and press up with elbows tucked.', bw),
  x('Triceps Kickback', 'triceps', 'dumbbells', [], 'Hinge forward with the upper arm parallel to the floor and extend the forearm back.', easy),
  // Forearms
  x('Wrist Curl', 'forearms', 'dumbbells', [], 'Forearms on thighs, palms up, curl the weight with the wrists only.', easy),
  x('Reverse Wrist Curl', 'forearms', 'dumbbells', [], 'Forearms on thighs, palms down, extend the wrists up and lower.', easy),
  x("Farmer's Walk", 'forearms', 'dumbbells', ['core', 'back'], 'Carry heavy dumbbells at your sides for distance with tall posture.', { tracking: 'distance' }),
  x('Dead Hang', 'forearms', 'bodyweight', ['back'], 'Hang from a bar with a firm grip for as long as possible.', { tracking: 'timed', difficulty: 'beginner' }),
  x('Reverse Curl', 'forearms', 'barbell', ['biceps'], 'Overhand grip curl keeping the wrists neutral.'),
  // Legs / Quads
  x('Barbell Back Squat', 'quadriceps', 'barbell', ['glutes', 'hamstrings', 'core'], 'Bar on the upper back, brace, squat until the thighs are at least parallel, drive up through the whole foot.', hard),
  x('Front Squat', 'quadriceps', 'barbell', ['glutes', 'core'], 'Bar racked on the front shoulders with elbows high, squat keeping the torso upright.', hard),
  x('Goblet Squat', 'quadriceps', 'dumbbells', ['glutes', 'core'], 'Hold a dumbbell at the chest and squat between the knees with an upright torso.', easy),
  x('Leg Press', 'quadriceps', 'machine', ['glutes', 'hamstrings'], 'Feet shoulder width on the platform, lower until the knees are about 90 degrees and press without locking out harshly.', easy),
  x('Hack Squat', 'quadriceps', 'machine', ['glutes'], 'Back on the pad, squat deep and press the platform away.'),
  x('Leg Extension', 'quadriceps', 'machine', [], 'Extend the knees to straighten the legs, pause, and lower slowly.', easy),
  x('Bulgarian Split Squat', 'quadriceps', 'dumbbells', ['glutes'], 'Rear foot on a bench, lower the back knee towards the floor and drive up through the front foot.'),
  x('Walking Lunge', 'quadriceps', 'dumbbells', ['glutes', 'hamstrings'], 'Step forward into a lunge, lower the back knee, then step through into the next rep.'),
  x('Reverse Lunge', 'quadriceps', 'dumbbells', ['glutes'], 'Step back into a lunge and return to standing.', easy),
  x('Step-up', 'quadriceps', 'dumbbells', ['glutes'], 'Step onto a box driving through the lead leg, then lower under control.', easy),
  x('Bodyweight Squat', 'quadriceps', 'bodyweight', ['glutes'], 'Feet shoulder width, sit back and down, then stand.', bwEasy),
  x('Wall Sit', 'quadriceps', 'bodyweight', ['glutes'], 'Back against a wall with thighs parallel to the floor; hold.', { tracking: 'timed', difficulty: 'beginner' }),
  x('Sissy Squat', 'quadriceps', 'bodyweight', [], 'Lean back as the knees travel forward, lowering with a rigid torso.', bwHard),
  // Hamstrings
  x('Romanian Deadlift', 'hamstrings', 'barbell', ['glutes', 'back'], 'Soft knees, hinge the hips back keeping the bar close, feel the hamstring stretch, then stand.'),
  x('Dumbbell Romanian Deadlift', 'hamstrings', 'dumbbells', ['glutes'], 'Hinge at the hips lowering dumbbells along the legs and return.', easy),
  x('Lying Leg Curl', 'hamstrings', 'machine', ['calves'], 'Curl the pad towards the glutes and lower slowly.', easy),
  x('Seated Leg Curl', 'hamstrings', 'machine', [], 'Seated, curl the pad down and back under control.', easy),
  x('Good Morning', 'hamstrings', 'barbell', ['glutes', 'back'], 'Bar on the upper back, hinge forward with a flat back and stand up.', hard),
  x('Nordic Curl', 'hamstrings', 'bodyweight', [], 'Kneeling with feet anchored, lower the torso forward as slowly as possible and push back up.', bwHard),
  x('Stiff-leg Deadlift', 'hamstrings', 'barbell', ['glutes', 'back'], 'Keep the legs nearly straight and hinge at the hips to lower the bar.'),
  // Glutes
  x('Hip Thrust', 'glutes', 'barbell', ['hamstrings'], 'Upper back on a bench, bar across the hips, drive the hips up and squeeze the glutes at the top.'),
  x('Glute Bridge', 'glutes', 'bodyweight', ['hamstrings'], 'Lying on the back, drive the hips up by squeezing the glutes.', bwEasy),
  x('Cable Kickback', 'glutes', 'cable', ['hamstrings'], 'With an ankle strap, kick the leg back against the cable.', easy),
  x('Sumo Deadlift', 'glutes', 'barbell', ['quadriceps', 'back', 'hamstrings'], 'Wide stance, hands inside the knees, push the floor apart and stand tall.', hard),
  x('Kettlebell Swing', 'glutes', 'kettlebell', ['hamstrings', 'core', 'shoulders'], 'Hinge and snap the hips to swing the kettlebell to chest height.'),
  x('Hip Abduction Machine', 'glutes', 'machine', [], 'Seated, push the pads apart against resistance.', easy),
  x('Frog Pump', 'glutes', 'bodyweight', [], 'Lying with soles together and knees out, drive the hips up.', bwEasy),
  // Calves
  x('Standing Calf Raise', 'calves', 'machine', [], 'Rise up on the toes through the full range, pause at the top, lower into a stretch.', easy),
  x('Seated Calf Raise', 'calves', 'machine', [], 'With knees bent, raise the heels as high as possible and lower slowly.', easy),
  x('Single-leg Calf Raise', 'calves', 'bodyweight', [], 'On a step, raise the heel of one foot and lower below the step.', bw),
  x('Donkey Calf Raise', 'calves', 'machine', [], 'Hinged forward with weight on the hips, perform calf raises.'),
  // Abs
  x('Crunch', 'abs', 'bodyweight', [], 'Curl the shoulders off the floor by contracting the abs; avoid pulling on the neck.', bwEasy),
  x('Cable Crunch', 'abs', 'cable', [], 'Kneeling at a high pulley, curl the torso down towards the hips.'),
  x('Hanging Leg Raise', 'abs', 'bodyweight', ['forearms'], 'Hang from a bar and raise the legs to hip height or higher with no swinging.', bwHard),
  x('Lying Leg Raise', 'abs', 'bodyweight', [], 'Lie flat, raise the legs to vertical and lower without touching the floor.', bw),
  x('Sit-up', 'abs', 'bodyweight', [], 'Lie on your back, curl all the way up to sitting, then lower.', bwEasy),
  x('Bicycle Crunch', 'abs', 'bodyweight', ['core'], 'Alternate bringing opposite elbow and knee together in a pedalling motion.', bw),
  x('Ab Wheel Rollout', 'abs', 'other', ['core', 'shoulders'], 'From the knees, roll the wheel forward keeping the back flat and return.', bwHard),
  x('Decline Sit-up', 'abs', 'bodyweight', [], 'On a decline bench, perform a controlled sit-up.', bw),
  // Core
  x('Plank', 'core', 'bodyweight', ['abs', 'shoulders'], 'On forearms and toes, hold a straight line from head to heels.', { tracking: 'timed', difficulty: 'beginner' }),
  x('Side Plank', 'core', 'bodyweight', ['abs'], 'On one forearm, stack the feet and lift the hips; hold.', { tracking: 'timed', difficulty: 'beginner' }),
  x('Russian Twist', 'core', 'bodyweight', ['abs'], 'Seated with the torso leaned back, rotate side to side, optionally holding a weight.', bw),
  x('Pallof Press', 'core', 'cable', ['shoulders'], 'Press the handle straight out against rotational pull, hold, and return.'),
  x('Dead Bug', 'core', 'bodyweight', ['abs'], 'On your back, lower opposite arm and leg while keeping the lower back flat.', bwEasy),
  x('Bird Dog', 'core', 'bodyweight', ['back', 'glutes'], 'On hands and knees, extend opposite arm and leg and hold briefly.', bwEasy),
  x('Mountain Climber', 'core', 'bodyweight', ['abs', 'shoulders'], 'In a push-up position, drive the knees alternately to the chest.', { tracking: 'duration', type: 'cardio', difficulty: 'beginner' }),
  x('Hollow Hold', 'core', 'bodyweight', ['abs'], 'Lie flat, lift shoulders and legs slightly off the floor and hold.', timed),
  x('Suitcase Carry', 'core', 'kettlebell', ['forearms'], 'Carry a heavy weight in one hand while staying upright.', { tracking: 'distance' }),
  // Full body
  x('Clean and Press', 'full_body', 'barbell', ['shoulders', 'legs', 'back'], 'Pull the bar from the floor to the shoulders in one motion, then press it overhead.', hard),
  x('Thruster', 'full_body', 'barbell', ['legs', 'shoulders'], 'Front squat straight into an overhead press in one fluid movement.', hard),
  x('Burpee', 'full_body', 'bodyweight', ['chest', 'legs'], 'Drop to a push-up, jump the feet in and jump up with arms overhead.', { tracking: 'bodyweight_reps', type: 'cardio' }),
  x('Turkish Get-up', 'full_body', 'kettlebell', ['shoulders', 'core'], 'Rise from lying to standing while holding a weight overhead, then reverse.', hard),
  x('Kettlebell Clean', 'full_body', 'kettlebell', ['glutes', 'back'], 'Swing the kettlebell up to the rack position in one smooth pull.'),
  x('Sled Push', 'full_body', 'other', ['legs'], 'Drive the sled forward with a low body angle for distance.', { tracking: 'distance' }),
  x('Battle Ropes', 'full_body', 'other', ['shoulders', 'core'], 'Create alternating waves with the ropes in an athletic stance.', { tracking: 'duration', type: 'cardio' }),
  x('Box Jump', 'full_body', 'other', ['legs'], 'Jump from both feet onto a box, land softly and step down.', bw),
  x('Man Maker', 'full_body', 'dumbbells', ['chest', 'back', 'shoulders'], 'Combine a push-up, renegade row and thruster with dumbbells.', hard),
  // Cardio-style duration/distance exercises
  x('Rowing Machine', 'full_body', 'machine', ['back', 'legs'], 'Drive with the legs, lean back, then pull the handle to the ribs; reverse the order to return.', { tracking: 'distance', type: 'cardio' }),
  x('Stationary Bike', 'legs', 'machine', [], 'Cycle at a steady or interval effort.', { tracking: 'duration', type: 'cardio', difficulty: 'beginner' }),
  x('Jump Rope', 'full_body', 'other', ['calves'], 'Skip rope with small jumps on the balls of the feet.', { tracking: 'duration', type: 'cardio' }),
  x('Stair Climber', 'legs', 'machine', ['glutes'], 'Climb the machine stairs without leaning on the handrails.', { tracking: 'duration', type: 'cardio' }),
  // Mobility
  x('Cat-Cow', 'core', 'bodyweight', ['back'], 'On hands and knees, alternate arching and rounding the spine slowly.', { tracking: 'duration', type: 'mobility', difficulty: 'beginner' }),
  x("World's Greatest Stretch", 'full_body', 'bodyweight', ['hamstrings', 'glutes'], 'Lunge with the opposite elbow to the instep, rotate and reach to the sky.', { tracking: 'duration', type: 'mobility', difficulty: 'beginner' }),
  x('Hip Flexor Stretch', 'legs', 'bodyweight', ['glutes'], 'Half-kneeling, tuck the pelvis and shift forward to stretch the front of the hip.', { tracking: 'timed', type: 'mobility', difficulty: 'beginner' }),
  x('Foam Roll Back', 'back', 'other', [], 'Roll the upper back slowly over a foam roller.', { tracking: 'duration', type: 'mobility', difficulty: 'beginner' }),
];
