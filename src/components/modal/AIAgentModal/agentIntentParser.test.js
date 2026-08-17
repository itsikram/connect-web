import { parseIntent, searchFriendsByName } from "./agentIntentParser";

const atikProfile = {
  _id: "67e431d61e4463f7adfa544e",
  fullName: "Md Atik",
  nickname: "Football",
  username: "mdatikbd",
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

  test.each(["Atik", "Md Atik", "Football", "mdatikbd"])(
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

  test("keeps plain message commands as open-chat intents", () => {
    expect(parseIntent("message Rahima")).toMatchObject({
      action: "SEND_MESSAGE",
      targetName: "Rahima",
      messageText: null,
    });
  });
});
