import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/result";
import { deleteAccount } from "./account";
import type { AccountEraser } from "./ports";

const USER = "11111111-1111-4111-8111-111111111111";

function makeEraser(overrides: Partial<AccountEraser> = {}): AccountEraser {
  return {
    moneyInPlay: async () => false,
    erase: async () => ok(true as const),
    ...overrides,
  };
}

describe("deleteAccount", () => {
  it("erases the account of the person who typed the word, in any case", async () => {
    for (const typed of ["DELETE", "delete", "  Delete  "]) {
      const erase = vi.fn(async () => ok(true as const));
      const result = await deleteAccount(
        { eraser: makeEraser({ erase }) },
        { userId: USER, role: "investor", confirmation: typed },
      );
      expect(result).toEqual(ok(true));
      expect(erase).toHaveBeenCalledWith(USER);
    }
  });

  it("needs the word and never calls the store without it", async () => {
    const erase = vi.fn(async () => ok(true as const));
    for (const confirmation of ["", "delet", "DELETE ME", "yes", undefined, null, 42]) {
      const result = await deleteAccount(
        { eraser: makeEraser({ erase }) },
        { userId: USER, role: "business", confirmation },
      );
      expect(result).toEqual(err("confirm_required"));
    }
    expect(erase).not.toHaveBeenCalled();
  });

  it("never deletes an administrator, even with the word typed", async () => {
    const erase = vi.fn(async () => ok(true as const));
    const result = await deleteAccount(
      { eraser: makeEraser({ erase }) },
      { userId: USER, role: "admin", confirmation: "DELETE" },
    );
    expect(result).toEqual(err("not_allowed"));
    expect(erase).not.toHaveBeenCalled();
  });

  it("passes each refusal from the store through", async () => {
    for (const code of ["money_held", "not_allowed", "failed"] as const) {
      const result = await deleteAccount(
        { eraser: makeEraser({ erase: async () => err(code) }) },
        { userId: USER, role: "donor", confirmation: "DELETE" },
      );
      expect(result).toEqual(err(code));
    }
  });
});
