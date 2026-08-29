export const Colors = {
  primary: "#07508E",
  secondary: "#F2B635",
  white: "#FFFFFF",
  navy: "#002B5C",
  text: {
    dark: "#172033",
    light: "#5E6B82",
    inverse: "#FFFFFF",
  },
  background: {
    main: "#F4F7FB",
    card: "#FFFFFF",
    alt: "#E9EFF7",
    subtle: "#F8FAFD",
  },
  button: {
    primary: "#07508E",
    primaryDark: "#053C6A",
    gold: "#D99D16",
  },
  border: "#D9E2EE",
  error: "#B42318",
  success: "#18794E",
  warning: "#B54708",
  info: "#07508E",
  state: {
    scheduled: { background: "#EAF1F8", foreground: "#07508E" },
    assigned: { background: "#FFF4D8", foreground: "#8A5A00" },
    inProgress: { background: "#DCF4E7", foreground: "#12683F" },
    completed: { background: "#E8ECF2", foreground: "#435168" },
  },
} as const;
