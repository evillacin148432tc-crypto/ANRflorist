// ANR Florist design tokens (same export names as before, so every page keeps working).
export const colors = {
  ink: "#2A1F2D",
  inkSoft: "#7A6B78",
  plum: "#6B3FA0",
  plumDeep: "#4E2D75",
  plumTint: "#F1EAF8",
  fern: "#3F6B4A",
  fernTint: "#E7F0E9",
  marigold: "#B4700F",
  marigoldTint: "#FBEFDC",
  brick: "#A8433D",
  brickTint: "#F7E7E5",
  paper: "#FCFAF8",
  card: "#FFFFFF",
  line: "#ECE2DC",
  white: "#FFFFFF",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 12, md: 16, lg: 22, pill: 999 };

export const type = {
  display: { fontSize: 26, fontWeight: "800", color: colors.ink },
  title: { fontSize: 19, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, fontWeight: "400", color: colors.ink },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: "400", color: colors.inkSoft },
};

// Soft shadow that works on iOS, Android and web.
export const shadow = {
  shadowColor: "#4E2D75",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

// Keeps content readable on tablets/web while filling a phone edge to edge.
export const layout = { maxWidth: 520 };

export const shared = {
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  buttonPrimary: {
    backgroundColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  buttonPrimaryText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonOutlineText: { color: colors.plum, fontSize: 15, fontWeight: "700" },
};
