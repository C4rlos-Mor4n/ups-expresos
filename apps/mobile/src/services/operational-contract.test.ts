import { OperationalContractError, operationalContract } from "./operational-contract";

describe("operationalContract.currentDriverRun", () => {
  it("accepts the documented JSON null response from the driver endpoint", () => {
    expect(operationalContract.currentDriverRun(null)).toBeNull();
  });

  it("rejects malformed non-null current-run payloads", () => {
    expect(() => operationalContract.currentDriverRun({})).toThrow(OperationalContractError);
    expect(() => operationalContract.currentDriverRun("")).toThrow(OperationalContractError);
  });
});
