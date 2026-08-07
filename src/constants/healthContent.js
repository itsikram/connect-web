/** Fitness knowledge sections and daily wellness checklist defaults. */

export const HEALTH_DISCLAIMER =
    'This page shares general fitness and wellness information only. It is not medical advice. Consult a doctor before starting a new exercise or nutrition program.';

export const FITNESS_CATEGORIES = [
    { id: 'basics', label: 'Fitness Basics', icon: 'fa-dumbbell' },
    { id: 'workout', label: 'Workouts', icon: 'fa-running' },
    { id: 'nutrition', label: 'Nutrition', icon: 'fa-apple-alt' },
    { id: 'recovery', label: 'Recovery', icon: 'fa-bed' },
    { id: 'mindset', label: 'Mindset', icon: 'fa-brain' },
];

export const FITNESS_ARTICLES = {
    basics: [
        {
            title: 'Start Where You Are',
            summary: 'Consistency beats intensity when you are building a fitness habit.',
            points: [
                'Aim for 150 minutes of moderate activity per week — that can be 30 minutes, 5 days a week.',
                'Mix cardio (walking, cycling, swimming) with strength training twice a week.',
                'Track how you feel, not just the scale: energy, sleep, and mood matter.',
                'Increase volume or intensity by about 10% per week to avoid burnout and injury.',
            ],
        },
        {
            title: 'Warm Up & Cool Down',
            summary: 'Five to ten minutes before and after training protects joints and improves results.',
            points: [
                'Warm up with dynamic moves: leg swings, arm circles, light jogging, or bodyweight squats.',
                'Save static stretching for after your session when muscles are warm.',
                'Cool down with slow walking and deep breathing to bring heart rate down gradually.',
                'Never skip warm-ups on leg day or heavy lifting days.',
            ],
        },
        {
            title: 'Know Your Training Zones',
            summary: 'Training at the right effort level helps you build endurance without overtraining.',
            points: [
                'Easy pace: you can hold a full conversation — great for most daily cardio.',
                'Moderate pace: you can speak in short sentences — ideal for steady-state runs or rides.',
                'Hard effort: only a few words at a time — use sparingly for intervals or time trials.',
                'Most of your weekly cardio should feel easy to moderate, not max effort every session.',
            ],
        },
    ],
    workout: [
        {
            title: 'Beginner Full-Body (3× per week)',
            summary: 'A simple plan you can do at home or in the gym with minimal equipment.',
            points: [
                'Day A: Squats, push-ups (or incline), rows, plank — 3 sets of 8–12 reps each.',
                'Day B: Lunges, overhead press, glute bridge, dead bug — same rep range.',
                'Rest at least one day between sessions so muscles can recover and adapt.',
                'Add weight or reps only when you can complete all sets with good form.',
            ],
        },
        {
            title: 'Strength Training Principles',
            summary: 'Progressive overload is how you get stronger over months, not days.',
            points: [
                'Prioritize compound lifts: squat, hinge, push, pull, and carry patterns.',
                'Rest 2–3 minutes between heavy sets; 60–90 seconds for lighter accessory work.',
                'Log your workouts so you know when to add weight, reps, or sets.',
                'Deload every 4–6 weeks: reduce volume by 30–40% to recover and come back stronger.',
            ],
        },
        {
            title: 'Cardio That Fits Your Life',
            summary: 'The best cardio plan is one you will actually stick to.',
            points: [
                'Walking 8,000–10,000 steps daily is a solid baseline for most people.',
                'Try 2–3 structured sessions: one long easy session, one tempo, one optional interval day.',
                'Use the “talk test” — most sessions should allow comfortable conversation.',
                'Pair low-impact options (cycling, elliptical) with running if joints need a break.',
            ],
        },
    ],
    nutrition: [
        {
            title: 'Protein for Recovery',
            summary: 'Adequate protein supports muscle repair and keeps you full between meals.',
            points: [
                'A common target: roughly 1.6–2.2 g per kg of body weight if you train regularly.',
                'Spread protein across meals — eggs, yogurt, chicken, fish, lentils, tofu, or protein shakes.',
                'Post-workout: protein plus carbs within 1–2 hours helps refill glycogen and repair tissue.',
                'Whole foods first; supplements only fill gaps in your diet.',
            ],
        },
        {
            title: 'Hydration & Performance',
            summary: 'Even mild dehydration affects strength, focus, and endurance.',
            points: [
                'Drink water steadily through the day — pale yellow urine is a simple check.',
                'Around workouts: 500 ml in the 2 hours before; sip during longer sessions.',
                'Replace sweat losses after hard training — water plus electrolytes if you sweat heavily.',
                'Limit sugary drinks; caffeine is fine for most people in moderation before noon.',
            ],
        },
        {
            title: 'Balanced Plates',
            summary: 'Build meals around whole foods without extreme restriction.',
            points: [
                'Half your plate: vegetables and fruit for fiber, vitamins, and volume.',
                'One quarter: lean protein; one quarter: whole grains or starchy carbs.',
                'Include healthy fats: olive oil, nuts, seeds, avocado — they support hormones and satiety.',
                'Plan one or two flexible meals per week so your plan stays sustainable long term.',
            ],
        },
    ],
    recovery: [
        {
            title: 'Sleep & Muscle Growth',
            summary: 'Training breaks muscle down; sleep and nutrition build it back up.',
            points: [
                'Aim for 7–9 hours nightly — growth hormone and recovery peak during deep sleep.',
                'Keep a consistent bedtime; dim screens 60 minutes before sleep.',
                'Cool, dark, quiet room; avoid heavy meals and alcohol close to bedtime.',
                'If you sleep poorly after evening workouts, try training earlier in the day.',
            ],
        },
        {
            title: 'Rest Days That Work',
            summary: 'Recovery is when adaptation happens — not laziness.',
            points: [
                'Schedule at least 1–2 full rest or active recovery days per week.',
                'Active recovery: walking, yoga, light cycling — movement without strain.',
                'Foam rolling and mobility 10 minutes daily can reduce stiffness.',
                'Persistent soreness, poor sleep, or declining performance may mean you need more rest.',
            ],
        },
        {
            title: 'Injury Prevention',
            summary: 'Listen to pain signals early to stay consistent long term.',
            points: [
                'Sharp or joint pain: stop and assess — distinguish soreness from injury.',
                'Increase running mileage by no more than 10% per week.',
                'Rotate shoe types and surfaces if you run frequently on pavement.',
                'See a physiotherapist for pain that lasts more than a week or limits daily movement.',
            ],
        },
    ],
    mindset: [
        {
            title: 'Build Identity, Not Just Goals',
            summary: '“I am someone who trains” beats “I need to lose 5 kg” for lasting change.',
            points: [
                'Set process goals: “Train Monday, Wednesday, Friday” instead of only outcome goals.',
                'Celebrate small wins: showing up, adding one rep, cooking one healthy meal.',
                'Missed a day? Restart the next day — one gap does not erase progress.',
                'Find a workout buddy or community for accountability and enjoyment.',
            ],
        },
        {
            title: 'Track What Matters',
            summary: 'Use simple metrics that motivate without obsessing over the scale.',
            points: [
                'Weekly: workouts completed, average steps, sleep hours, energy level (1–10).',
                'Monthly: strength numbers, waist measurement, progress photos if helpful.',
                'Avoid weighing daily — water and food timing cause normal fluctuations.',
                'Journal one sentence after workouts: what went well and what to improve.',
            ],
        },
        {
            title: 'Stay Motivated Long Term',
            summary: 'Motivation fades; systems and habits carry you through.',
            points: [
                'Lay out gym clothes the night before; pack meals on Sunday if that helps.',
                'Stack habits: “After coffee, I walk 10 minutes.”',
                'Vary workouts seasonally to prevent boredom — swim in summer, hike in fall.',
                'Revisit your “why” monthly: health, family, confidence, sport — write it down.',
            ],
        },
    ],
};

export const DAILY_WELLNESS_ITEMS = [
    { id: 'water', label: 'Drank enough water', icon: 'fa-tint' },
    { id: 'move', label: 'Moved for 30+ minutes', icon: 'fa-walking' },
    { id: 'protein', label: 'Hit protein goal', icon: 'fa-drumstick-bite' },
    { id: 'sleep', label: 'Slept 7+ hours', icon: 'fa-moon' },
    { id: 'stretch', label: 'Stretched or mobilized', icon: 'fa-spa' },
    { id: 'steps', label: 'Walked 8,000+ steps', icon: 'fa-shoe-prints' },
];

export const QUICK_TIPS = [
    'Take the stairs when you can — small bursts add up across the week.',
    'Eat protein at breakfast to reduce cravings later in the day.',
    'Stand up and move for 2 minutes every hour if you sit at a desk.',
    'Schedule workouts like meetings — non-negotiable blocks in your calendar.',
    'Prep vegetables on Sunday so healthy choices are the easy choice.',
    'A 10-minute walk after meals can improve blood sugar and digestion.',
    'Progress photos every 4 weeks often show change the scale misses.',
    'Breathing exercises for 5 minutes lower stress and improve recovery.',
];
