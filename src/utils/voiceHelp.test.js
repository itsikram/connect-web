import {
  getVoiceHelpLang,
  isVoiceHelpEnabled,
  setVoiceHelpEnabled,
  setVoiceHelpLang,
  speakHelp,
} from "./voiceHelp";

const ENGLISH = { name: "Google US English", lang: "en-US", localService: false };
const BANGLA = { name: "Google বাংলা", lang: "bn-BD", localService: false };

const installSpeech = (voices) => {
  const spoken = [];
  window.speechSynthesis = {
    getVoices: () => voices,
    speak: (utterance) => spoken.push(utterance),
    cancel: jest.fn(),
    resume: jest.fn(),
    speaking: false,
    pending: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
  return spoken;
};

afterEach(() => {
  localStorage.clear();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

test("is on by default and can be turned off", () => {
  expect(isVoiceHelpEnabled()).toBe(true);
  setVoiceHelpEnabled(false);
  expect(isVoiceHelpEnabled()).toBe(false);
});

test("reads the English label by default", () => {
  const spoken = installSpeech([ENGLISH, BANGLA]);
  const result = speakHelp({ en: "Messages", bn: "মেসেজ" });
  expect(result.spoken).toBe(true);
  expect(spoken).toHaveLength(1);
  expect(spoken[0].text).toBe("Messages");
  expect(spoken[0].lang).toBe("en-US");
});

test("reads Bangla when chosen and the phone has a Bangla voice", () => {
  const spoken = installSpeech([ENGLISH, BANGLA]);
  setVoiceHelpLang("bn");
  expect(getVoiceHelpLang()).toBe("bn");
  const result = speakHelp({ en: "Messages", bn: "মেসেজ" });
  expect(spoken[0].text).toBe("মেসেজ");
  expect(spoken[0].lang).toBe("bn-BD");
  expect(result.text).toBe("মেসেজ");
});

test("without a Bangla voice it speaks English but still shows the Bangla text", () => {
  const spoken = installSpeech([ENGLISH]);
  setVoiceHelpLang("bn");
  const result = speakHelp({ en: "Messages", bn: "মেসেজ" });
  expect(spoken[0].text).toBe("Messages");
  expect(result.text).toBe("মেসেজ");
});

test("without speech support it only returns the text to show", () => {
  const result = speakHelp({ en: "Messages" });
  expect(result).toEqual({ spoken: false, text: "Messages" });
});
