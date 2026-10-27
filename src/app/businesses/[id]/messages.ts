import type { StartError } from "@/application/funding";
import { formatRand } from "@/domain/money";

/** Turns a refused contribution into a plain sentence, and says whether identity verification would help. */
export function describeStartError(error: StartError): {
  message: string;
  needsVerification: boolean;
} {
  switch (error.code) {
    case "amount_out_of_range":
      return {
        message: "Enter an amount between R10 and R1 000 000, for example 250 or 250.50.",
        needsVerification: false,
      };
    case "goal_full":
      return {
        message:
          error.remainingCents > 0
            ? `This goal only needs ${formatRand(error.remainingCents)} more.`
            : "This goal is fully funded.",
        needsVerification: false,
      };
    case "limit_reached":
      return {
        message:
          error.remainingCents > 0
            ? `Until your identity is verified you can give R1 000 in total. You can still give ${formatRand(error.remainingCents)}.`
            : "You have reached the R1 000 limit that applies until your identity is verified.",
        needsVerification: true,
      };
    case "goal_closed":
      return { message: "This goal is closed.", needsVerification: false };
    case "goal_not_found":
      return { message: "That goal isn't available.", needsVerification: false };
    case "not_allowed":
      return { message: "Only supporter accounts can contribute.", needsVerification: false };
    case "invalid_input":
    case "failed":
      return {
        message: "We couldn't start that contribution. Please try again.",
        needsVerification: false,
      };
  }
}
