import { describe, expect, it } from "vitest";
import { signUpInput } from "@/application/auth";
import { readLogInForm, readSignUpForm } from "./form-input";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const filled = {
  fullName: "Thandi Mokoena",
  email: "thandi@example.com",
  password: "correct-horse-battery",
  role: "business",
};

describe("readSignUpForm", () => {
  it("passes a ticked consent box through, so a valid form validates", () => {
    const { input } = readSignUpForm(form({ ...filled, consent: "on" }));
    expect(input.consent).toBe(true);
    expect(signUpInput.safeParse(input).success).toBe(true);
  });

  it("treats a missing consent box as not consented", () => {
    const { input } = readSignUpForm(form(filled));
    expect(input.consent).toBe(false);
    expect(signUpInput.safeParse(input).success).toBe(false);
  });

  it("never puts the password in the values sent back to the page", () => {
    const { values } = readSignUpForm(form({ ...filled, consent: "on" }));
    expect(values).not.toHaveProperty("password");
    expect(JSON.stringify(values)).not.toContain(filled.password);
  });

  it("copes with missing fields", () => {
    const { input } = readSignUpForm(new FormData());
    expect(input).toEqual({ fullName: "", email: "", role: "", consent: false, password: "" });
  });
});

describe("readLogInForm", () => {
  it("reads email and password", () => {
    expect(readLogInForm(form({ email: "a@b.co", password: "pw" }))).toEqual({
      email: "a@b.co",
      password: "pw",
    });
  });
});
