// ANR Florist design tokens.
// Colors are drawn from real flowers, stems, and soil rather than a default
// SaaS/Material palette — orchid purple instead of stock blue, botanical
// green instead of stock green, warm paper instead of stark white.

export const colors = {
  ink: "#2E2422", // warm near-black for text — brown undertone, not pure black
  inkSoft: "#6B5D59", // secondary text, captions, hints

  plum: "#6B3FA0", // primary / brand — orchid/iris purple, not a neon template purple
  plumDeep: "#4E2D75", // pressed/active state of plum
  plumTint: "#EFE7F5", // pale plum background wash (chips, highlights)

  fern: "#3F6B4A", // success / verified / delivered / available
  fernTint: "#E7F0E9",

  marigold: "#B4700F", // warning / low stock — marigold-gold
  marigoldTint: "#FBEFDC",

  brick: "#A8433D", // danger / delete / cancel — muted brick-red
  brickTint: "#F7E7E5",

  paper: "#FBF8F6", // app background — warm off-white
  card: "#F4ECE7", // card surface — one step deeper than paper
  line: "#E7DAD3", // hairline borders (used instead of drop shadows)

  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 8, // buttons, chips, inputs
  md: 14, // product cards in the shop grid
  lg: 18, // containers, sheets — kept distinct so hierarchy reads clearly
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: "700", color: colors.ink },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, fontWeight: "400", color: colors.ink },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: "400", color: colors.inkSoft },
};

// Shared shapes so every screen's cards/buttons/inputs stay consistent
// without a drop shadow on everything (the generic "SaaS card kit" look).
export const shared = {
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  buttonPrimary: {
    backgroundColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: colors.plum,
    fontSize: 15,
    fontWeight: "700",
  },
};
