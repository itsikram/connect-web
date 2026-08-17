/**
 * Gemini API integration for addiction recovery support
 */

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Get AI support and counseling for addiction recovery
 */
export const getRecoverySupportMessage = async (params) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured. Please add REACT_APP_GEMINI_API_KEY to your .env file');
    }

    const {
        substanceType,
        daysClean,
        currentMood,
        craving,
        message,
        triggers,
    } = params;

    const prompt = `You are a compassionate addiction recovery counselor providing support to someone in recovery.

Recovery Information:
- Substance: ${substanceType}
- Days Clean: ${daysClean} days
- Current Mood: ${currentMood}
- Craving Level: ${craving}/10
- Identified Triggers: ${triggers?.join(', ') || 'Not specified'}
- User Message: "${message}"

Provide a supportive, non-judgmental response that:
1. Validates their feelings
2. Offers practical coping strategies if they're struggling
3. Celebrates progress and milestones
4. Encourages professional help if needed
5. Reminds them of their strength and resilience
6. Keeps the response concise and encouraging (under 150 words)

Be warm, empathetic, and hope-focused. Remember: relapse is not failure, and every moment is a chance to choose recovery.`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 500,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response generated');
        }

        const content = data.candidates[0].content.parts[0].text;
        return {
            message: content,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error getting recovery support:', error);
        throw error;
    }
};

/**
 * Get relapse prevention plan tailored to the user
 */
export const getRelapsePrevention = async (params) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const {
        substanceType,
        daysClean,
        personalTriggers,
        supportSystems,
        goals,
    } = params;

    const prompt = `You are an addiction recovery specialist creating a personalized relapse prevention plan.

User Profile:
- Substance: ${substanceType}
- Days Clean: ${daysClean}
- Personal Triggers: ${personalTriggers?.join(', ') || 'General triggers'}
- Support Systems: ${supportSystems?.join(', ') || 'Building support'}
- Goals: ${goals?.join(', ') || 'Maintain sobriety'}

Create a practical relapse prevention plan in JSON format (respond with ONLY valid JSON):
{
  "title": "Your Personalized Relapse Prevention Plan",
  "earlyWarnings": [
    "warning sign 1",
    "warning sign 2",
    "warning sign 3"
  ],
  "copingStrategies": [
    { "trigger": "...", "strategy": "..." },
    { "trigger": "...", "strategy": "..." }
  ],
  "emergencyPlan": "Step-by-step plan if urges become overwhelming",
  "supportContacts": "List of who to call/text when struggling",
  "dailyPractices": [
    "practice 1",
    "practice 2",
    "practice 3"
  ],
  "weeklyGoals": [
    "goal 1",
    "goal 2"
  ]
}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1500,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No plan generated');
        }

        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse relapse prevention plan');
        }

        const plan = JSON.parse(jsonMatch[0]);
        return plan;
    } catch (error) {
        console.error('Error getting relapse prevention plan:', error);
        throw error;
    }
};

/**
 * Get personalized coping strategies for current craving
 */
export const getCopingStrategies = async (params) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const {
        substanceType,
        craving,
        location,
        timeAvailable,
        previousSuccesses,
    } = params;

    const prompt = `You are an addiction recovery specialist suggesting coping strategies for immediate use.

Current Situation:
- Substance: ${substanceType}
- Craving Intensity: ${craving}/10
- Current Location: ${location}
- Time Available: ${timeAvailable} minutes
- What Has Worked Before: ${previousSuccesses?.join(', ') || 'Not yet identified'}

Suggest 4 immediate coping strategies in JSON format (respond with ONLY valid JSON):
{
  "strategies": [
    {
      "name": "Strategy name",
      "steps": ["step 1", "step 2", "step 3"],
      "duration": "X minutes",
      "effectiveness": "Why this works now"
    }
  ],
  "encouragement": "Brief motivational message",
  "emergencyAction": "Do this if craving gets worse"
}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1000,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No strategies generated');
        }

        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse coping strategies');
        }

        const strategies = JSON.parse(jsonMatch[0]);
        return strategies;
    } catch (error) {
        console.error('Error getting coping strategies:', error);
        throw error;
    }
};

/**
 * Analyze craving and provide insights
 */
export const analyzeCraving = async (params) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    const {
        substanceType,
        intensity,
        trigger,
        emotionalState,
        notes,
    } = params;

    const prompt = `You are an addiction recovery counselor analyzing a craving episode.

Craving Information:
- Substance: ${substanceType}
- Intensity: ${intensity}/10
- Trigger: ${trigger}
- Emotional State: ${emotionalState}
- Additional Notes: ${notes}

Provide analysis in JSON format (respond with ONLY valid JSON):
{
  "analysis": "Understanding of this craving pattern",
  "triggerCategory": "emotional|social|environmental|physical",
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "riskLevel": "low|medium|high",
  "immediateAction": "What to do right now"
}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1000,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No analysis generated');
        }

        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse craving analysis');
        }

        const analysis = JSON.parse(jsonMatch[0]);
        return analysis;
    } catch (error) {
        console.error('Error analyzing craving:', error);
        throw error;
    }
};
