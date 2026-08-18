import { useEffect, useState } from "react";

export function useTheme(profileTheme, profileDarkMode) {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(mediaQuery.matches);
    const listener = (event) => setPrefersDark(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const themeMode = profileTheme || (profileDarkMode ? "dark" : "system");
    const dark = themeMode === "system" ? prefersDark : themeMode === "dark";
    const bg = dark ? "#15171A" : "#F6F7F5";
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
  }, [profileTheme, profileDarkMode, prefersDark]);

  return { prefersDark };
}
