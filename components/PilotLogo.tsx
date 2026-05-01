// Pilot's brand-style square logo: rounded purple square with a white "P".
// Sized via the `size` prop. Used in the sidebar and as a favicon-style
// indicator anywhere the brand mark belongs.

interface Props {
  size?: number;
  className?: string;
}

export function PilotLogo({ size = 32, className }: Props) {
  return (
    <span
      aria-label="Pilot"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background:
          "linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)", // violet-700 → violet-800
        color: "white",
        fontWeight: 700,
        fontSize: Math.round(size * 0.55),
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        letterSpacing: "-0.02em",
      }}
    >
      P
    </span>
  );
}
