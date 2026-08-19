import { escapeScriptJson } from "./scriptJson";

describe("escapeScriptJson", () => {
  it("serializes a normal stop without escaping needed characters", () => {
    const json = escapeScriptJson({ name: "Parque de la Madre" });
    expect(json).toBe('{"name":"Parque de la Madre"}');
  });

  it("escapes quotes so the JSON remains valid", () => {
    const json = escapeScriptJson({ name: 'Dijo "hola"' });
    expect(json).toContain('\\"');
  });

  it("escapes HTML tags", () => {
    const json = escapeScriptJson({ name: "<b>bold</b>" });
    expect(json).not.toContain("<b>");
    expect(json).toContain("\\u003cb\\u003e");
  });

  it("prevents closing the script block", () => {
    const json = escapeScriptJson({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<script>");
    expect(json).toContain("\\u003c/script\\u003e");
  });

  it("escapes unicode line separators", () => {
    const json = escapeScriptJson({ name: "line\u2028break" });
    expect(json).toContain("\\u2028");
  });

  it("produces JSON that parses back to the same object", () => {
    const original = { name: "</script>", reference: 'a "quote" & <tag>' };
    const json = escapeScriptJson(original);
    const reparsed = Function(`"use strict"; return (${json});`)();
    expect(reparsed).toEqual(original);
  });
});
