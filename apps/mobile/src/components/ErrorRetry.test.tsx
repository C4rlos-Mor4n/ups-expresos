import React from "react";
import { create, act } from "react-test-renderer";
import ErrorRetry from "./ErrorRetry";

function renderErrorRetry(props: React.ComponentProps<typeof ErrorRetry>) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<ErrorRetry {...props} />);
  });
  return tree;
}

describe("ErrorRetry", () => {
  it("renders the default message when none is provided", () => {
    const tree = renderErrorRetry({ onRetry: () => {} });
    const message = tree.root.findByProps({
      children: "No pudimos conectarnos al servidor. Verifica tu conexión e intenta nuevamente.",
    });
    expect(message).toBeTruthy();
  });

  it("renders a custom title and message", () => {
    const tree = renderErrorRetry({ title: "Error", message: "Mensaje custom", onRetry: () => {} });
    expect(tree.root.findByProps({ children: "Error" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Mensaje custom" })).toBeTruthy();
  });

  it("does not render a button when onRetry is not provided", () => {
    const tree = renderErrorRetry({});
    const buttons = tree.root.findAllByProps({ accessibilityRole: "button" });
    expect(buttons.length).toBe(0);
  });

  it("calls onRetry when the button is pressed", () => {
    const onRetry = jest.fn();
    const tree = renderErrorRetry({ onRetry });
    const button = tree.root.findByProps({ accessibilityRole: "button" });
    act(() => {
      button.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button while retrying", () => {
    const tree = renderErrorRetry({ onRetry: () => {}, retrying: true });
    const button = tree.root.findByProps({ accessibilityRole: "button" });
    expect(button.props.disabled).toBe(true);
  });
});