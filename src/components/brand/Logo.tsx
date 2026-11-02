import Image from "next/image";

type Props = {
  /** "dark" is the green logo for light backgrounds; "light" is the cream one for the dark green panel. */
  tone: "dark" | "light";
  className?: string;
  priority?: boolean;
};

export function Logo({ tone, className, priority }: Props) {
  return (
    <Image
      src={tone === "dark" ? "/brand/logo-dark.png" : "/brand/logo-light.png"}
      alt="Kasi-Kapital: your kasi, your capital"
      width={500}
      height={498}
      priority={priority}
      quality={90}
      className={className}
    />
  );
}

/** The cursive name used in the app's top bar, as in the dashboard designs. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-cursive font-bold leading-none ${className}`}>Kasi-Kapital</span>;
}
