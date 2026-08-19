import { Colors } from "./Colors";

describe("Colors (active theme)", () => {
  it("defines the primary brand colors", () => {
    expect(Colors.primary).toBe("#00205B");
    expect(Colors.secondary).toBe("#F2A900");
    expect(Colors.white).toBe("#FFFFFF");
  });

  it("defines the full text palette", () => {
    expect(Colors.text.dark).toBeDefined();
    expect(Colors.text.light).toBeDefined();
  });

  it("defines the background palette", () => {
    expect(Colors.background.main).toBeDefined();
    expect(Colors.background.card).toBeDefined();
    expect(Colors.background.alt).toBeDefined();
  });

  it("defines button, border and status colors", () => {
    expect(Colors.button.primary).toBeDefined();
    expect(Colors.border).toBeDefined();
    expect(Colors.error).toBeDefined();
    expect(Colors.success).toBeDefined();
    expect(Colors.warning).toBeDefined();
    expect(Colors.info).toBeDefined();
  });
});
