/**
 * Recovery support via the same LLM client as the AI Agent.
 */

import { completeChat } from "../services/llmClient";
import { hasConfiguredApiKey } from "../services/aiAgentSettings";

const extractJsonObject = (text = "") => {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

const requireKey = () => {
  if (!hasConfiguredApiKey()) {
    throw new Error(
      "No AI key is configured. Add one in Connect Admin → Settings → AI, or in the agent gear menu.",
    );
  }
};

export const getRecoverySupportMessage = async (params) => {
  requireKey();
  const {
    substanceType,
    daysClean,
    currentMood,
    craving,
    message,
    triggers,
  } = params;

  const content = await completeChat({
    system: `You are a compassionate addiction recovery counselor. Be warm, non-judgmental, and hope-focused. Relapse is not failure. Keep the reply under 150 words. Do not give medical diagnoses.`,
    messages: [
      {
        role: "user",
        content: `Substance: ${substanceType}
Days clean: ${daysClean}
Mood: ${currentMood}
Craving: ${craving}/10
Triggers: ${triggers?.join(", ") || "Not specified"}
Message: ${message || "I could use some support."}`,
      },
    ],
    temperature: 0.7,
    maxTokens: 400,
    operationLabel: "Recovery support",
  });

  return {
    message: String(content || "").trim(),
    timestamp: new Date().toISOString(),
  };
};

export const getRelapsePrevention = async (params) => {
  requireKey();
  const {
    substanceType,
    daysClean,
    personalTriggers,
    supportSystems,
    goals,
  } = params;

  const raw = await completeChat({
    system: `Create a practical relapse prevention plan. Return ONLY JSON:
{
  "title": "Your Personalized Relapse Prevention Plan",
  "earlyWarnings": ["warning 1", "warning 2", "warning 3"],
  "copingStrategies": [{ "trigger": "...", "strategy": "..." }],
  "emergencyPlan": "...",
  "supportContacts": "...",
  "dailyPractices": ["practice 1", "practice 2"],
  "weeklyGoals": ["goal 1", "goal 2"]
}`,
    messages: [
      {
        role: "user",
        content: `Substance: ${substanceType}
Days clean: ${daysClean}
Triggers: ${personalTriggers?.join(", ") || "General triggers"}
Support: ${supportSystems?.join(", ") || "Building support"}
Goals: ${goals?.join(", ") || "Maintain recovery"}`,
      },
    ],
    json: true,
    temperature: 0.6,
    maxTokens: 900,
    operationLabel: "Relapse prevention",
  });

  const plan = extractJsonObject(raw);
  if (!plan) throw new Error("Could not parse relapse prevention plan");
  return plan;
};

export const getCopingStrategies = async (params) => {
  requireKey();
  const { substanceType, craving, location, timeAvailable, previousSuccesses } =
    params;

  const raw = await completeChat({
    system: `Suggest 4 immediate coping strategies. Return ONLY JSON:
{
  "strategies": [
    { "name": "...", "steps": ["step 1", "step 2"], "duration": "X minutes", "effectiveness": "..." }
  ],
  "encouragement": "...",
  "emergencyAction": "..."
}`,
    messages: [
      {
        role: "user",
        content: `Substance: ${substanceType}
Craving: ${craving}/10
Location: ${location}
Time available: ${timeAvailable} minutes
What worked before: ${previousSuccesses?.join(", ") || "Not yet identified"}`,
      },
    ],
    json: true,
    temperature: 0.6,
    maxTokens: 800,
    operationLabel: "Coping strategies",
  });

  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Could not parse coping strategies");
  return parsed;
};

export const analyzeCraving = async (params) => {
  requireKey();
  const { substanceType, intensity, trigger, emotionalState, notes } = params;

  const raw = await completeChat({
    system: `Analyze a craving episode. Return ONLY JSON:
{
  "analysis": "...",
  "triggerCategory": "emotional|social|environmental|physical",
  "insights": ["insight 1"],
  "recommendations": ["recommendation 1"],
  "riskLevel": "low|medium|high",
  "immediateAction": "..."
}`,
    messages: [
      {
        role: "user",
        content: `Substance: ${substanceType}
Intensity: ${intensity}/10
Trigger: ${trigger}
Mood: ${emotionalState}
Notes: ${notes}`,
      },
    ],
    json: true,
    temperature: 0.5,
    maxTokens: 700,
    operationLabel: "Craving analysis",
  });

  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Could not parse craving analysis");
  return parsed;
};
