import React from "react";
import { create, act } from "react-test-renderer";
import RouteOperationBadge from "./RouteOperationBadge";

function renderBadge(status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "SUSPENDED" | null | undefined) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RouteOperationBadge status={status} />);
  });
  return tree;
}

describe("RouteOperationBadge", () => {
  it("renders null when status is null", () => {
    const tree = renderBadge(null);
    expect(tree.toJSON()).toBeNull();
  });

  it("renders null when status is undefined", () => {
    const tree = renderBadge(undefined);
    expect(tree.toJSON()).toBeNull();
  });

  it("renders 'Programado' for SCHEDULED", () => {
    const tree = renderBadge("SCHEDULED");
    const text = tree.root.findByProps({ children: "Programado" });
    expect(text).toBeTruthy();
  });

  it("renders 'En recorrido' for IN_PROGRESS", () => {
    const tree = renderBadge("IN_PROGRESS");
    const text = tree.root.findByProps({ children: "En recorrido" });
    expect(text).toBeTruthy();
  });

  it("renders 'Finalizado' for COMPLETED", () => {
    const tree = renderBadge("COMPLETED");
    const text = tree.root.findByProps({ children: "Finalizado" });
    expect(text).toBeTruthy();
  });

  it("renders 'Cancelado' for CANCELLED", () => {
    const tree = renderBadge("CANCELLED");
    const text = tree.root.findByProps({ children: "Cancelado" });
    expect(text).toBeTruthy();
  });

  it("renders 'Suspendido' for SUSPENDED", () => {
    const tree = renderBadge("SUSPENDED");
    const text = tree.root.findByProps({ children: "Suspendido" });
    expect(text).toBeTruthy();
  });
});