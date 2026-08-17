import { parseIntent, searchFriendsByName } from "./agentIntentParser";

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
