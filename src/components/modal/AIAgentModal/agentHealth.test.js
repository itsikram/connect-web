import { planHealthAction, toClockTime, toMoodScore } from "./agentHealth";
import { parseAgentPlan } from "../../../services/geminiService";

describe("web fitness + recovery actions", () => {
  it("plans the same requests as the Connect app", () => {
    expect(planHealthAction("LOG_WATER", { glasses: 2 })).toMatchObject({
      method: "put",
      url: "/fitness/daily",
      body: { addWaterMl: 500 },
    });
    expect(planHealthAction("LOG_WEIGHT", { weightLb: 154 })).toMatchObject({ body: { weightKg: 69.9 } });
    expect(() => planHealthAction("LOG_MEAL", { name: "Biryani" })).toThrow(/calories/i);
    expect(toClockTime("সন্ধ্যা ৭টা")).toBe("19:00");
    expect(toMoodScore("মন খারাপ")).toBe(2);
  });

  it("opens web pages instead of app screens", () => {
    expect(planHealthAction("RECOVERY_SOS", {})).toMatchObject({ kind: "navigate", route: "/rehab" });
    expect(planHealthAction("FITNESS_PROGRESS", {})).toMatchObject({ route: "/health/progress" });
    const summary = planHealthAction("FITNESS_SUMMARY", {});
    expect(summary.thenOpen({ profile: null })).toBe("/health/setup");
  });

  it("keeps the model's parameters when parsing a plan", () => {
    const plan = parseAgentPlan(
      '{"reply":"Logged","actions":[{"action":"LOG_MEAL","name":"Rice","calories":600,"proteinG":12}]}',
    );
    expect(plan.intents[0]).toMatchObject({
      action: "LOG_MEAL",
      params: { name: "Rice", calories: 600, proteinG: 12 },
    });
  });
});
