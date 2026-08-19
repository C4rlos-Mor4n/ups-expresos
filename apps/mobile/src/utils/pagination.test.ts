import { appendPage } from "./pagination";

function item(id: string) {
  return { id };
}

describe("appendPage", () => {
  it("appends a second page without duplicates", () => {
    const first = appendPage([], [item("a"), item("b")], { page: 1, totalPages: 2 });
    const second = appendPage(first.items, [item("c")], { page: 2, totalPages: 2 });
    expect(second.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(second.hasMore).toBe(false);
  });

  it("marks hasMore true when not on the last page", () => {
    const res = appendPage([], [item("a")], { page: 1, totalPages: 3 });
    expect(res.hasMore).toBe(true);
  });

  it("deduplicates overlapping ids", () => {
    const res = appendPage([item("a")], [item("a"), item("b")], { page: 1, totalPages: 1 });
    expect(res.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("handles an empty incoming page", () => {
    const res = appendPage([item("a")], [], { page: 2, totalPages: 2 });
    expect(res.items.map((i) => i.id)).toEqual(["a"]);
    expect(res.hasMore).toBe(false);
  });

  it("a fresh refresh replaces the accumulated pages", () => {
    // Un refresh empieza desde cero y solo trae la primera página.
    const refreshed = appendPage([], [item("a")], { page: 1, totalPages: 2 });
    expect(refreshed.items.map((i) => i.id)).toEqual(["a"]);
    expect(refreshed.hasMore).toBe(true);
  });

  it("marks hasMore false when the page is the last one", () => {
    const res = appendPage([], [item("a"), item("b")], { page: 2, totalPages: 2 });
    expect(res.hasMore).toBe(false);
  });

  it("keeps later pages stable when a duplicate id appears with newer data", () => {
    const first = appendPage([], [item("a"), item("b")], { page: 1, totalPages: 1 });
    const refreshed = appendPage([], [item("a")], { page: 1, totalPages: 1 });
    const merged = appendPage(first.items, refreshed.items, { page: 1, totalPages: 1 });
    expect(merged.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
