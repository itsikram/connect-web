/**
 * Rehabilitation content and constants for substance abuse support
 */

export const REHAB_DISCLAIMER = 'This is a supportive tool, not a replacement for professional medical care. If you\'re struggling with addiction, please consult a healthcare professional or call a helpline. In crisis, contact emergency services immediately.';

export const ADDICTION_TYPES = [
    { id: 'cigarettes', label: 'Cigarettes', icon: 'fa-smoking', color: '#ef4444' },
    { id: 'alcohol', label: 'Alcohol', icon: 'fa-wine-glass-alt', color: '#f97316' },
    { id: 'cannabis', label: 'Cannabis', icon: 'fa-leaf', color: '#22c55e' },
    { id: 'opioids', label: 'Opioids', icon: 'fa-pill', color: '#8b5cf6' },
    { id: 'stimulants', label: 'Stimulants (Cocaine, Meth)', icon: 'fa-zap', color: '#ec4899' },
    { id: 'other', label: 'Other Substances', icon: 'fa-flask', color: '#06b6d4' },
];

export const COPING_STRATEGIES = [
    {
        id: 'breathing',
        title: 'Deep Breathing Exercise',
        description: 'Calm your nervous system with controlled breathing',
        instructions: [
            'Inhale slowly through your nose for 4 counts',
            'Hold your breath for 4 counts',
            'Exhale slowly through your mouth for 4 counts',
            'Repeat 5-10 times until you feel calmer',
        ],
        duration: '2-5 minutes',
        icon: 'fa-wind',
    },
    {
        id: 'exercise',
        title: 'Physical Activity',
        description: 'Exercise releases endorphins and reduces cravings',
        instructions: [
            'Do a 10-minute walk, jog, or dance session',
            'Try yoga or stretching',
            'Do bodyweight exercises (push-ups, squats)',
            'Any movement helps - start small',
        ],
        duration: '10-30 minutes',
        icon: 'fa-running',
    },
    {
        id: 'mindfulness',
        title: 'Mindfulness Meditation',
        description: 'Observe cravings without acting on them',
        instructions: [
            'Find a quiet place and sit comfortably',
            'Focus on your breath or body sensations',
            'When your mind wanders, gently bring it back',
            'Notice cravings like clouds passing in the sky',
        ],
        duration: '5-15 minutes',
        icon: 'fa-spa',
    },
    {
        id: 'hydration',
        title: 'Hydration & Nutrition',
        description: 'Stabilize blood sugar and reduce withdrawal symptoms',
        instructions: [
            'Drink a glass of water - thirst mimics cravings',
            'Eat a healthy snack (fruit, nuts, yogurt)',
            'Avoid sugary drinks that spike blood sugar',
            'Stay hydrated throughout the day',
        ],
        duration: 'Immediate',
        icon: 'fa-droplet',
    },
    {
        id: 'distraction',
        title: 'Distraction Techniques',
        description: 'Redirect your mind to something engaging',
        instructions: [
            'Call a friend or family member',
            'Watch a movie or TV show',
            'Play a game or hobby you enjoy',
            'Read a book or browse the internet',
        ],
        duration: '10-30 minutes',
        icon: 'fa-gamepad',
    },
    {
        id: 'journaling',
        title: 'Journaling',
        description: 'Process emotions and understand craving triggers',
        instructions: [
            'Write about what triggered the craving',
            'Express your feelings without judgment',
            'Write about your goals and why you want to quit',
            'Reflect on past successes',
        ],
        duration: '10-20 minutes',
        icon: 'fa-pen-fancy',
    },
    {
        id: 'ice',
        title: 'Cold Water Shock',
        description: 'Interrupt the craving cycle with physical sensation',
        instructions: [
            'Splash cold water on your face',
            'Hold ice cubes in your hand',
            'Take a cold shower if possible',
            'The sensation resets your nervous system',
        ],
        duration: '1-2 minutes',
        icon: 'fa-snowflake',
    },
    {
        id: 'social',
        title: 'Social Support',
        description: 'Connect with others who understand your struggle',
        instructions: [
            'Text or call a trusted friend',
            'Join a support group meeting',
            'Share your feelings with someone you trust',
            'Ask for accountability and encouragement',
        ],
        duration: 'Flexible',
        icon: 'fa-users',
    },
];

export const WITHDRAWAL_SYMPTOMS = {
    cigarettes: [
        'Intense cravings (usually 3-5 minutes)',
        'Irritability and mood swings',
        'Difficulty concentrating',
        'Anxiety or restlessness',
        'Increased appetite',
        'Sleep disturbances',
        'Headaches (usually within 24 hours)',
    ],
    alcohol: [
        'Anxiety and tremors',
        'Sweating and chills',
        'Headaches and muscle aches',
        'Nausea and vomiting (may require medical care)',
        'Insomnia',
        'Hallucinations or seizures (severe cases - get help)',
    ],
    cannabis: [
        'Irritability and anxiety',
        'Sleep problems',
        'Loss of appetite',
        'Mood swings',
        'Vivid dreams',
        'Restlessness',
    ],
    opioids: [
        'Severe body aches and chills',
        'Sweating and watery eyes',
        'Dilated pupils',
        'Nausea and vomiting (requires medical supervision)',
        'Anxiety and insomnia',
        'Seek medical help immediately',
    ],
    stimulants: [
        'Depression and fatigue',
        'Increased appetite',
        'Sleep disturbances',
        'Lack of motivation',
        'Anxiety',
        'Body aches',
    ],
};

export const MOTIVATIONAL_QUOTES = [
    'Every moment is a new opportunity to choose recovery.',
    'Your brain is healing. Be patient with yourself.',
    'The cravings will pass. They always do.',
    'You are stronger than your urges.',
    'One day at a time. You can do this.',
    'Recovery is a journey, not a destination.',
    'Your future self will thank you for quitting today.',
    'I am in control of my choices.',
    'Cravings are temporary. My commitment is permanent.',
    'I deserve a healthy, free life.',
    'Each sober day is a victory.',
    'My health is worth it.',
    'I am breaking the cycle.',
    'Withdrawal is temporary. Addiction recovery is forever.',
    'I am building a better version of myself.',
    'My life has value beyond this substance.',
    'I choose myself, today.',
    'Every day gets easier.',
    'I am not defined by my addiction.',
    'My body is healing with every hour.',
];

export const RESOURCES = [
    {
        name: 'SAMHSA National Helpline',
        description: 'Free, confidential, 24/7 treatment referral and information',
        phone: '1-800-662-4357 (HELP)',
        website: 'www.samhsa.gov',
        available: '24/7',
        type: 'helpline',
    },
    {
        name: 'Alcoholics Anonymous (AA)',
        description: 'Peer support groups for alcohol addiction',
        website: 'www.aa.org',
        phone: 'Check website for local meetings',
        available: 'Varies by location',
        type: 'support-group',
    },
    {
        name: 'Narcotics Anonymous (NA)',
        description: 'Support for all types of drug addiction',
        website: 'www.na.org',
        phone: 'Check website for local meetings',
        available: 'Varies by location',
        type: 'support-group',
    },
    {
        name: 'Nicotine Anonymous',
        description: 'Support specifically for tobacco addiction',
        website: 'www.nicotine-anonymous.org',
        phone: 'Check website for local meetings',
        available: 'Varies by location',
        type: 'support-group',
    },
    {
        name: 'Crisis Text Line',
        description: 'Text-based crisis support, not just for suicide',
        website: 'www.crisistextline.org',
        phone: 'Text HOME to 741741',
        available: '24/7',
        type: 'crisis',
    },
    {
        name: 'National Suicide Prevention Lifeline',
        description: 'Support for mental health crisis (call for addiction too)',
        website: 'www.suicidepreventionlifeline.org',
        phone: '988',
        available: '24/7',
        type: 'crisis',
    },
    {
        name: 'SMART Recovery',
        description: 'Self-Empowerment and Recovery Training',
        website: 'www.smartrecovery.org',
        phone: 'Check website for meetings',
        available: 'Varies by location',
        type: 'support-group',
    },
    {
        name: 'Celebrate Recovery',
        description: 'Faith-based recovery program',
        website: 'www.celebraterecovery.com',
        phone: 'Check website for meetings',
        available: 'Varies by location',
        type: 'support-group',
    },
];

export const RECOVERY_MILESTONES = [
    { days: 1, title: '1 Day', description: 'The hardest step - you started!' },
    { days: 3, title: '3 Days', description: 'Peak withdrawal is behind you' },
    { days: 7, title: '1 Week', description: 'You\'ve got this!' },
    { days: 14, title: '2 Weeks', description: 'Your body is healing' },
    { days: 30, title: '1 Month', description: 'You\'re breaking the habit loop' },
    { days: 100, title: '100 Days', description: 'Major milestone!' },
    { days: 180, title: '6 Months', description: 'Physical cravings are much less' },
    { days: 365, title: '1 Year', description: 'Complete victory! You did it!' },
];

export const HEALTH_BENEFITS = {
    cigarettes: [
        { time: '20 minutes', benefit: 'Heart rate and blood pressure drop' },
        { time: '8 hours', benefit: 'Carbon monoxide levels drop by half' },
        { time: '24 hours', benefit: 'Lung function starts improving' },
        { time: '2-3 days', benefit: 'Nicotine is out of your system' },
        { time: '2 weeks', benefit: 'Circulation and lung function improve' },
        { time: '3 months', benefit: 'Lung capacity increases by 30%' },
        { time: '9 months', benefit: 'Cough and shortness of breath reduce' },
        { time: '1 year', benefit: 'Heart disease risk drops by 50%' },
    ],
    alcohol: [
        { time: '6-24 hours', benefit: 'Liver begins to recover' },
        { time: '1 week', benefit: 'Sleep quality improves' },
        { time: '2-4 weeks', benefit: 'Mental health improves, anxiety decreases' },
        { time: '3 months', benefit: 'Liver function improves significantly' },
        { time: '6 months', benefit: 'Heart rate and blood pressure normalize' },
        { time: '1 year', benefit: 'Cancer risk decreases, organ damage reverses' },
    ],
    cannabis: [
        { time: '24-48 hours', benefit: 'THC clears from bloodstream' },
        { time: '1-2 weeks', benefit: 'Sleep improves, anxiety decreases' },
        { time: '4 weeks', benefit: 'Memory and concentration improve' },
        { time: '8 weeks', benefit: 'Lung function improves' },
        { time: '3-6 months', benefit: 'Motivation and energy return' },
        { time: '6-12 months', benefit: 'Full cognitive recovery' },
    ],
    opioids: [
        { time: '6-12 hours', benefit: 'Withdrawal begins (seek medical help)' },
        { time: '3-7 days', benefit: 'Acute withdrawal peaks' },
        { time: '1-2 weeks', benefit: 'Physical symptoms ease with medical support' },
        { time: '4 weeks', benefit: 'Brain chemistry starts normalizing' },
        { time: '3 months', benefit: 'Emotional stability improves' },
        { time: '6-12 months', benefit: 'Full recovery with proper treatment' },
    ],
};

export const RELAPSE_WARNING_SIGNS = [
    'Thinking about using "just once"',
    'Avoiding people in recovery',
    'Neglecting self-care or exercise',
    'Isolating yourself from support',
    'Returning to places associated with use',
    'Feeling overconfident about recovery',
    'Ignoring cravings instead of addressing them',
    'Sleep deprivation or poor eating',
    'Lying to yourself or others',
    'Testing yourself around triggers',
    'Romanticizing past use',
    'Skipping support meetings',
];

export const RELAPSE_PREVENTION = [
    'Create a support network and use it regularly',
    'Avoid high-risk situations and triggers',
    'Develop healthy coping mechanisms',
    'Exercise regularly - releases natural endorphins',
    'Maintain a consistent sleep schedule',
    'Practice stress-management techniques',
    'Keep medications (if prescribed) as directed',
    'Attend support group meetings regularly',
    'Journal about feelings and triggers',
    'Plan for high-risk situations in advance',
    'Celebrate milestones and small victories',
    'Be honest with your support team about struggles',
];

export const COMMON_TRIGGERS = [
    { trigger: 'Social situations', strategy: 'Practice saying "no", bring a support person, have an exit plan' },
    { trigger: 'Stress and anxiety', strategy: 'Use coping strategies like breathing, exercise, or meditation' },
    { trigger: 'Boredom', strategy: 'Find new hobbies, exercise, call a friend, volunteer' },
    { trigger: 'Certain places', strategy: 'Avoid them at first, gradually build tolerance with support' },
    { trigger: 'Specific people', strategy: 'Set boundaries, limit contact, surround yourself with supportive people' },
    { trigger: 'Negative emotions', strategy: 'Talk to someone, journal, practice self-compassion' },
    { trigger: 'Fatigue and hunger', strategy: 'Sleep well, eat regularly, maintain energy levels' },
    { trigger: 'Overconfidence', strategy: 'Remember why you quit, stay humble, attend meetings' },
];

export const THERAPY_TYPES = [
    {
        name: 'Cognitive Behavioral Therapy (CBT)',
        description: 'Helps identify and change thought patterns that lead to use',
        effectiveness: 'Highly effective for most substances',
    },
    {
        name: 'Motivational Interviewing',
        description: 'Helps resolve ambivalence about quitting',
        effectiveness: 'Great for building intrinsic motivation',
    },
    {
        name: 'Contingency Management',
        description: 'Rewards for staying abstinent',
        effectiveness: 'Particularly effective in early recovery',
    },
    {
        name: 'Group Therapy',
        description: 'Shared experiences with others in recovery',
        effectiveness: 'Provides community and reduces isolation',
    },
    {
        name: 'Family Therapy',
        description: 'Heals relationships damaged by addiction',
        effectiveness: 'Improves support systems',
    },
    {
        name: 'Medication-Assisted Treatment',
        description: 'Medications to reduce cravings (especially opioids/alcohol)',
        effectiveness: 'Highly effective when combined with counseling',
    },
];
