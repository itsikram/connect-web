import { parseIntent, searchFriendsByName } from "./agentIntentParser";
import {
  extractCaptionFromText,
  recoverAgentActions,
  isPlaceholderCaption,
  getMissingIntentSlots,
  mergeFollowUpIntent,
  isAffirmativeFollowUp,
  isCancelFollowUp,
} from "./agentCatalog";

const atikProfile = {
  _id: "67e431d61e4463f7adfa544e",
  fullName: "Md Atik",
  nickname: "Football",
  username: "mdatikbd",
  banglaName: "আতিক",
  user: {
    firstName: "Md",
    surname: "Atik",
  },
};

describe("friend profile navigation", () => {
  test("parses a translated Bengali profile command", () => {
    expect(parseIntent("Go to Atik's profile")).toMatchObject({
      action: "NAVIGATE_PROFILE",
      targetName: "Atik",
      subPath: "",
    });
  });

  test("parses direct profile open command", () => {
    expect(parseIntent("open Atik's profile")).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "Atik",
    });
  });

  test("parses bio/vio query as a text-fetch intent", () => {
    expect(parseIntent("what is the vio of atik?")).toMatchObject({
      action: "GET_BIO",
      targetName: "atik",
    });
  });

  test.each(["Atik", "Md Atik", "Football", "mdatikbd", "আতিক"])(
    "finds Atik by %s",
    (query) => {
      expect(searchFriendsByName([atikProfile], query)).toEqual([atikProfile]);
    },
  );
});

describe("direct send message parsing", () => {
  test("parses quoted english message sent to a friend", () => {
    expect(
      parseIntent('"Ki khobor" send this message to Rahima'),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "Rahima",
      messageText: "Ki khobor",
    });
  });

  test("parses bangla direct message command", () => {
    expect(parseIntent('রহিমা কে "কি খবর" মেসেজ পাঠাও')).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "রহিমা",
      messageText: "কি খবর",
    });
  });

  test("parses send message to X say Y format", () => {
    expect(parseIntent("send message to atik say where are you")).toMatchObject(
      {
        action: "SEND_MESSAGE_TO_USER",
        targetName: "atik",
        messageText: "where are you",
      },
    );
  });

  test("parses send message to X and say Y format", () => {
    expect(
      parseIntent("send message to atik and say where are you"),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "where are you",
    });
  });

  test("parses exact bangla send-message phrasing", () => {
    expect(
      parseIntent("আতিককে মেসেজ পাঠিয়ে বলো তুমি কোথায় আছো"),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "আতিক",
      messageText: "তুমি কোথায় আছো",
    });
  });

  test("parses bangla bartha variant of direct send-message phrasing", () => {
    expect(
      parseIntent("আতিককে বার্তা পাঠিয়ে বলো তুমি কোথায় আছো"),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "আতিক",
      messageText: "তুমি কোথায় আছো",
    });
  });

  test("keeps plain message commands as open-chat intents", () => {
    expect(parseIntent("message Rahima")).toMatchObject({
      action: "SEND_MESSAGE",
      targetName: "Rahima",
      messageText: null,
    });
  });
});

describe("create post parsing", () => {
  test("parses create me a post with a funny caption", () => {
    expect(parseIntent("create me a post with a funny caption")).toMatchObject({
      action: "CREATE_POST",
    });
  });

  test("parses create a post saying a caption", () => {
    expect(parseIntent("create a post saying I'm on energy-saving mode")).toMatchObject({
      action: "CREATE_POST",
      searchQuery: "I'm on energy-saving mode",
    });
  });
});

describe("create post recovery", () => {
  test("extracts a quoted caption from the assistant reply", () => {
    expect(
      extractCaptionFromText(
        "Here is a funny post for you: 'I'm not lazy, I'm just on energy-saving mode.' Creating your post now!",
      ),
    ).toBe("I'm not lazy, I'm just on energy-saving mode.");
  });

  test("injects CREATE_POST when Gemini only replies", () => {
    expect(isPlaceholderCaption("a funny caption")).toBe(true);
    const recovered = recoverAgentActions({
      actions: [],
      reply:
        "Here is a funny post for you: 'I'm not lazy, I'm just on energy-saving mode.' Creating your post now!",
      userMessage: "create me a post with a funny caption",
    });
    expect(recovered).toEqual([
      {
        action: "CREATE_POST",
        searchQuery: "I'm not lazy, I'm just on energy-saving mode.",
      },
    ]);
  });
});

describe("pending follow-up slots", () => {
  test("asks for a name when call has no target", () => {
    expect(parseIntent("call")).toMatchObject({
      action: "AUDIO_CALL",
      targetName: null,
    });
    expect(getMissingIntentSlots({ action: "AUDIO_CALL", targetName: null })).toEqual([
      "targetName",
    ]);
  });

  test("fills a pending call with the follow-up name", () => {
    const merged = mergeFollowUpIntent({
      pending: {
        intent: { action: "AUDIO_CALL", targetName: null },
        missing: ["targetName"],
      },
      followUpText: "John",
      geminiIntents: [],
    });
    expect(merged).toMatchObject({
      action: "AUDIO_CALL",
      targetName: "John",
    });
    expect(getMissingIntentSlots(merged)).toEqual([]);
  });

  test("treats yes as confirmation without changing the name", () => {
    const merged = mergeFollowUpIntent({
      pending: {
        intent: { action: "AUDIO_CALL", targetName: "John" },
        missing: [],
      },
      followUpText: "yes",
      geminiIntents: [],
    });
    expect(merged.targetName).toBe("John");
    expect(isAffirmativeFollowUp("yes")).toBe(true);
    expect(isCancelFollowUp("never mind")).toBe(true);
  });
});
