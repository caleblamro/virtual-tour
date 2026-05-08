import type { Theme } from "@react-navigation/native";

export const NAV_THEME: { light: Theme; dark: Theme } = {
  light: {
    dark: false,
    colors: {
      background: "hsl(0, 0%, 100%)",
      border: "hsl(240, 5.9%, 90%)",
      card: "hsl(0, 0%, 100%)",
      notification: "hsl(0, 84.2%, 60.2%)",
      primary: "hsl(240, 5.9%, 10%)",
      text: "hsl(240, 10%, 3.9%)",
    },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "900" },
    },
  },
  dark: {
    dark: true,
    colors: {
      background: "hsl(240, 10%, 3.9%)",
      border: "hsl(240, 3.7%, 15.9%)",
      card: "hsl(240, 10%, 3.9%)",
      notification: "hsl(0, 62.8%, 30.6%)",
      primary: "hsl(0, 0%, 98%)",
      text: "hsl(0, 0%, 98%)",
    },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "900" },
    },
  },
};
