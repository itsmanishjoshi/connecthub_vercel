import { createContext, ReactNode, useContext, useEffect } from 'react';
import { APP_THEME, type Theme } from '@/lib/themeUtils';

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'gcc_connecthub_theme';
const META_COLOR = '#0f172a';

const applyDarkTheme = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.classList.remove('light', 'accion');
  root.classList.add('dark');
  root.style.colorScheme = 'dark';
  root.setAttribute('data-theme', 'dark');

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', META_COLOR);
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    applyDarkTheme();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, APP_THEME);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: APP_THEME }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
