import { parseIntent, searchFriendsByName, splitFriendNames } from "./agentIntentParser";
import {
  extractCaptionFromText,
  recoverAgentActions,
  isPlaceholderCaption,
  getMissingIntentSlots,
  mergeFollowUpIntent,
  isAffirmativeFollowUp,
  isCancelFollowUp,
  isFastLocalIntent,
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

  test("parses find-profile commands for people who may not be friends", () => {
    expect(parseIntent("find me harun profile")).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "harun",
    });
    expect(parseIntent("find harun profile")).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "harun",
    });
    expect(parseIntent("find harun's profile")).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "harun",
    });
    expect(parseIntent("search for harun profile")).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "harun",
    });
  });

  test("keeps open my profile as a self-profile navigation", () => {
    expect(parseIntent("open my profile")).toMatchObject({
      action: "NAVIGATE",
      targetRoute: "MY_PROFILE",
    });
  });

  test("parses send friend request commands", () => {
    expect(parseIntent("please send friend request to harun")).toMatchObject({
      action: "ADD_FRIEND",
      targetName: "harun",
    });
    expect(parseIntent("send friend request to harun")).toMatchObject({
      action: "ADD_FRIEND",
      targetName: "harun",
    });
    expect(parseIntent("add harun as a friend")).toMatchObject({
      action: "ADD_FRIEND",
      targetName: "harun",
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
        messageText: "Where are you?",
      },
    );
  });

  test("parses send message to X and say Y format", () => {
    expect(
      parseIntent("send message to atik and say where are you"),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Where are you?",
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

  test("parses banglish send-message commands", () => {
    expect(parseIntent("atik ke message pathao tumi kothay")).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Tumi kothay",
    });
    expect(parseIntent("atik ke bolo koi ache")).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Koi ache",
    });
    expect(parseIntent("rahima ke msg pathao ki khobor")).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "rahima",
      messageText: "Ki khobor",
    });
  });

  test("parses banglish call, profile, ludo, and navigation", () => {
    expect(parseIntent("atik ke call koro")).toMatchObject({
      action: "AUDIO_CALL",
      targetName: "atik",
    });
    expect(parseIntent("atik er profile e jao")).toMatchObject({
      action: "NAVIGATE_PROFILE",
      targetName: "atik",
    });
    expect(parseIntent("ludo khela shuru koro")).toMatchObject({
      action: "CREATE_LUDO",
    });
    expect(parseIntent("atik ke ludo te invite koro")).toMatchObject({
      action: "INVITE_LUDO",
      targetName: "atik",
    });
    expect(parseIntent("settings e jao")).toMatchObject({
      action: "NAVIGATE",
      targetRoute: "/settings",
    });
  });

  test("parses polite and can-you navigation without an LLM", () => {
    expect(parseIntent("please open settings")).toMatchObject({
      action: "NAVIGATE",
      targetRoute: "/settings",
    });
    expect(parseIntent("can you go to messages")).toMatchObject({
      action: "OPEN_MESSAGES",
    });
    expect(parseIntent("please call atik")).toMatchObject({
      action: "AUDIO_CALL",
      targetName: "atik",
    });
  });

  test("parses bangla-script call, ludo, and navigation without an LLM", () => {
    expect(parseIntent("আতিককে কল করো")).toMatchObject({
      action: "AUDIO_CALL",
      targetName: "আতিক",
    });
    expect(parseIntent("লুডো খেলা শুরু করো")).toMatchObject({
      action: "CREATE_LUDO",
    });
    expect(parseIntent("সেটিংসে যাও")).toMatchObject({
      action: "NAVIGATE",
      targetRoute: "/settings",
    });
  });

  test("parses message X and ask Y as a real send", () => {
    expect(parseIntent("message atik and ask where is he")).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Where are you?",
    });
  });

  test("parses message X asking Y", () => {
    expect(parseIntent("message atik asking where he is")).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Where are you?",
    });
  });

  test("parses send atik a message and ask where he is", () => {
    expect(
      parseIntent("send atik a message and ask where he is"),
    ).toMatchObject({
      action: "SEND_MESSAGE_TO_USER",
      targetName: "atik",
      messageText: "Where are you?",
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
    expect(isAffirmativeFollowUp("haan")).toBe(true);
    expect(isCancelFollowUp("never mind")).toBe(true);
    expect(isCancelFollowUp("na")).toBe(true);
  });

  test("switches from a pending friend request to a profile lookup", () => {
    const switched = parseIntent("find me harun profile");
    const merged = mergeFollowUpIntent({
      pending: {
        intent: { action: "ADD_FRIEND", targetName: null },
        missing: ["targetName"],
      },
      followUpText: "find me harun profile",
      geminiIntents: switched ? [switched] : [],
    });
    expect(merged).toMatchObject({
      action: "VIEW_PROFILE",
      targetName: "harun",
    });
  });
});

describe("agent action parsing", () => {
  test("parses youtube download with a url", () => {
    expect(
      parseIntent("download this youtube video https://youtu.be/dQw4w9WgXcQ"),
    ).toMatchObject({
      action: "DOWNLOAD_YOUTUBE",
    });
  });

  test("parses youtube download by keyword", () => {
    expect(parseIntent("download despacito")).toMatchObject({
      action: "DOWNLOAD_YOUTUBE",
      searchQuery: "despacito",
    });
  });

  test("parses youtube search by keyword", () => {
    expect(parseIntent("search youtube for lo-fi beats")).toMatchObject({
      action: "SEARCH_YOUTUBE",
      searchQuery: "lo-fi beats",
    });
    expect(parseIntent("find despacito on youtube")).toMatchObject({
      action: "SEARCH_YOUTUBE",
      searchQuery: "despacito",
    });
  });

  test("parses delete post", () => {
    expect(parseIntent("delete my latest post")).toMatchObject({
      action: "DELETE_POST",
    });
  });

  test("parses ludo invite", () => {
    expect(parseIntent("invite Atik to ludo")).toMatchObject({
      action: "INVITE_LUDO",
      targetName: "Atik",
    });
  });

  test("parses create ludo game as a lobby start", () => {
    expect(parseIntent("create ludo game")).toMatchObject({
      action: "CREATE_LUDO",
      targetName: null,
    });
  });

  test("parses create ludo with a named friend as an invite", () => {
    expect(parseIntent("create ludo with Atik")).toMatchObject({
      action: "CREATE_LUDO",
      targetName: "Atik",
    });
    expect(parseIntent("create ludo game with Atik")).toMatchObject({
      action: "CREATE_LUDO",
      targetName: "Atik",
    });
  });

  test("parses create ludo and invite a friend", () => {
    expect(parseIntent("create a ludo game and invite Rahima")).toMatchObject({
      action: "CREATE_LUDO",
      targetName: "Rahima",
    });
  });

  test("create ludo and invite friends starts a lobby without a name", () => {
    expect(parseIntent("create ludo and invite friends")).toMatchObject({
      action: "CREATE_LUDO",
      targetName: null,
    });
  });

  test("splits multiple friend names", () => {
    expect(splitFriendNames("Atik and Rahima")).toEqual(["Atik", "Rahima"]);
    expect(splitFriendNames("friends")).toEqual([]);
  });

  test("parses calendar event with a day", () => {
    expect(parseIntent("add an event tomorrow dentist")).toMatchObject({
      action: "CREATE_EVENT",
    });
  });

  test("parses dark mode settings", () => {
    expect(parseIntent("set dark mode")).toMatchObject({
      action: "UPDATE_SETTINGS",
    });
  });

  test("parses health weight log", () => {
    expect(parseIntent("log weight 72")).toMatchObject({
      action: "LOG_HEALTH",
    });
  });

  test("parses video player", () => {
    expect(parseIntent("open the video player")).toMatchObject({
      action: "OPEN_VIDEO_PLAYER",
    });
  });

  test("treats parsed commands as fast local intents", () => {
    const intent = parseIntent("set dark mode");
    expect(isFastLocalIntent(intent, "set dark mode")).toBe(true);
    expect(isFastLocalIntent(null, "how are you")).toBe(false);
  });
});
