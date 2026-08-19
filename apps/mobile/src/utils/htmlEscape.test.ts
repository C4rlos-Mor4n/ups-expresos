import { escapeHtml } from "./htmlEscape";

describe("escapeHtml", () => {
  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Parque de la Madre")).toBe("Parque de la Madre");
  });

  it("escapes < and >", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });

  it("escapes &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('dijo "hola"')).toBe("dijo &quot;hola&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("neutralizes an img injection payload", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });

  it("neutralizes script and closing-script payloads", () => {
    const escaped = escapeHtml("</script><script>alert(1)</script>");
    expect(escaped).not.toContain("<script>");
    expect(escaped).not.toContain("</script>");
    expect(escaped).toContain("&lt;/script&gt;");
  });

  it("coerces numbers to strings", () => {
    expect(escapeHtml(7)).toBe("7");
  });
});
