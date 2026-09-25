import {
  buildAgentActionPrompt,
  looksLikeAgentPlan,
  parseAgentPlan,
} from "./geminiService";

describe("LLM action planning", () => {
  it("detects JSON plans while they stream", () => {
    expect(looksLikeAgentPlan('{"reply":"On it')).toBe(true);
    expect(looksLikeAgentPlan("```json\n{")).toBe(true);
    expect(looksLikeAgentPlan("Sure, here you go")).toBe(false);
  });

  it("turns a plan into validated intents", () => {
    const plan = parseAgentPlan(
      '{"reply":"Adding it","actions":[{"action":"CREATE_TASK","searchQuery":"pay rent"},{"action":"GO","targetRoute":"/notes"}]}',
      "add a task to pay rent and open notes",
    );
    expect(plan.isPlan).toBe(true);
    expect(plan.reply).toBe("Adding it");
    expect(plan.intents.map((intent) => intent.action)).toEqual([
      "CREATE_TASK",
      "NAVIGATE",
    ]);
    expect(plan.intents[0].searchQuery).toBe("pay rent");
    expect(plan.intents[1].targetRoute).toBe("/notes");
  });

  it("drops unknown actions and keeps plain text as a reply", () => {
    expect(
      parseAgentPlan('{"actions":[{"action":"LAUNCH_ROCKET"}]}').intents,
    ).toEqual([]);
    const prose = parseAgentPlan("Paris is the capital of France.");
    expect(prose).toMatchObject({ isPlan: false, intents: [] });
    expect(prose.reply).toBe("Paris is the capital of France.");
  });

  it("lists actions and routes for the model", () => {
    const prompt = buildAgentActionPrompt();
    expect(prompt).toContain("SEND_MESSAGE_TO_USER(");
    expect(prompt).toContain("/notes=Notes");
    expect(prompt).not.toContain("LOG_FITNESS_MEAL");
  });
});
