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
