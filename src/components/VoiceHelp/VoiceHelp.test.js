import React from "react";
import { act, render, screen } from "@testing-library/react";
import VoiceHelp from "./VoiceHelp";

// jsdom has no PointerEvent, so build pointer events from MouseEvent.
const pointer = (type, el, pointerType = "touch") => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
    button: 0,
  });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
};

const click = (el) => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
};

const setup = () => {
  const onClick = jest.fn();
  render(
    <>
      <VoiceHelp />
      <button type="button" data-speak="Messages. Chat with people." onClick={onClick}>
        Messages
      </button>
    </>,
  );
  return { button: screen.getByRole("button", { name: "Messages" }), onClick };
};

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

test("holding a button shows its name and does not open it", () => {
  const { button, onClick } = setup();
  pointer("pointerdown", button);
  act(() => {
    jest.advanceTimersByTime(600);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Messages. Chat with people.");
  pointer("pointerup", button);
  const event = click(button);
  expect(event.defaultPrevented).toBe(true);
  expect(onClick).not.toHaveBeenCalled();
});

test("a quick tap works as usual and says nothing", () => {
  const { button, onClick } = setup();
  pointer("pointerdown", button);
  act(() => {
    jest.advanceTimersByTime(120);
  });
  pointer("pointerup", button);
  click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
});

test("a new tap right after a hold is not swallowed", () => {
  const { button, onClick } = setup();
  pointer("pointerdown", button);
  act(() => {
    jest.advanceTimersByTime(600);
  });
  pointer("pointerup", button);
  // Some phones send no click after a long press; the next tap must work.
  pointer("pointerdown", button);
  pointer("pointerup", button);
  click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("a mouse is left alone: no speech on hold, normal right-click menu", () => {
  const { button, onClick } = setup();
  pointer("pointerdown", button, "mouse");
  act(() => {
    jest.advanceTimersByTime(800);
  });
  expect(screen.queryByRole("status")).toBeNull();
  pointer("pointerup", button, "mouse");
  click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(menu);
  expect(menu.defaultPrevented).toBe(false);
});

test("a touch long-press does not open the phone's link menu", () => {
  const { button } = setup();
  pointer("pointerdown", button);
  const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  button.dispatchEvent(menu);
  expect(menu.defaultPrevented).toBe(true);
});

test("turned off, holding does nothing", () => {
  localStorage.setItem("voice_help_enabled", "false");
  const { button, onClick } = setup();
  pointer("pointerdown", button);
  act(() => {
    jest.advanceTimersByTime(800);
  });
  expect(screen.queryByRole("status")).toBeNull();
  pointer("pointerup", button);
  click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
