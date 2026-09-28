import {
  describeAgentActionsForPrompt,
  nativeActionToWebIntent,
} from "./nativeAgentActions";
import { resolveAgentSetting } from "./agentAppSettings";
import {
  applyRelationshipChange,
  normalizeRelationshipTypes,
} from "./agentRelations";
import {
  buildNativeAgentRequestSystem,
  parseAgentPlan,
} from "../../../services/geminiService";

describe("Connect app agent actions on web", () => {
  test("sends the app's system prompt, catalog and settings", () => {
    const system = buildNativeAgentRequestSystem({
      preferredLanguage: "bn",
      memory: { knownConnects: [{ id: "1", name: "Rahim" }] },
    });
    expect(system).toContain("You are Connect AI: a capable, warm, and practical mobile assistant");
    expect(system).toContain("OUTPUT CONTRACT");
    expect(system).toContain("START_VIDEO_CALL(userName | userId): Start video call");
    expect(system).toContain("SETTINGS (key=values): themeMode=");
    expect(system).toContain("RELATIONSHIP TYPES: Friend, Best Friend");
    expect(system).toContain("Preferred response language: Bangla.");
    expect(system).toContain('"name":"Rahim"');
    expect(describeAgentActionsForPrompt()).not.toContain("navigate_vpn_browser");
  });

  test("translates the app's actions into web intents", () => {
    expect(
      nativeActionToWebIntent({
        action: "SEND_MESSAGE",
        parameters: { userName: "Rahim", message: "I'm late" },
      }),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "Rahim",
      messageText: "I'm late",
    });
    expect(
      nativeActionToWebIntent({ action: "START_VIDEO_CALL", parameters: { userId: "abc" } }),
    ).toMatchObject({ action: "VIDEO_CALL", targetId: "abc" });
    expect(
      nativeActionToWebIntent({ action: "QUERY_APP_DATA", parameters: { dataType: "events" } }),
    ).toMatchObject({ action: "QUERY_CONTENT", queryType: "calendar" });
    expect(nativeActionToWebIntent({ action: "navigate_tasks" })).toMatchObject({
      action: "NAVIGATE",
      targetRoute: "/tasks",
    });
    expect(
      nativeActionToWebIntent({ action: "VIEW_PROFILE", parameters: { userName: "me" } }),
    ).toMatchObject({ action: "NAVIGATE", targetRoute: "MY_PROFILE" });
    expect(
      nativeActionToWebIntent({
        action: "CHANGE_SETTING",
        parameters: { setting: "themeMode", value: "dark" },
      }),
    ).toMatchObject({ action: "CHANGE_SETTING", params: { setting: "themeMode", value: "dark" } });
    expect(nativeActionToWebIntent({ action: "navigate_vpn_browser" })).toBeNull();
  });

  test("parses the app's JSON contract", () => {
    const plan = parseAgentPlan(
      '{"type":"action","message":"Calling Rahim","speak":true,"requires_confirmation":false,"actions":[{"id":"a1","action":"START_AUDIO_CALL","status":"pending","parameters":{"userName":"Rahim"}}]}',
    );
    expect(plan.reply).toBe("Calling Rahim");
    expect(plan.intents[0]).toMatchObject({ action: "AUDIO_CALL", targetName: "Rahim" });
  });

  test("resolves settings and relationships like the app", () => {
    expect(resolveAgentSetting("dark mode", "on").updates).toEqual({ themeMode: "dark" });
    expect(resolveAgentSetting("read receipts", "off").updates).toEqual({ readReceipts: false });
    expect(normalizeRelationshipTypes(["brother", "best friend"])).toEqual([
      "Sibling",
      "Best Friend",
    ]);
    expect(applyRelationshipChange(["Friend"], ["Colleague"], "add")).toEqual([
      "Friend",
      "Colleague",
    ]);
  });
});
