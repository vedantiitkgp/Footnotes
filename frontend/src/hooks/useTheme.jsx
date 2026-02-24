import { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  { id: 'noir',      label: 'Noir',      accent: '#c9a96e', bg: '#0a0a0a' },
  { id: 'sakura',    label: 'Sakura',    accent: '#e8a5c0', bg: '#1c0812' },
  { id: 'ocean',     label: 'Ocean',     accent: '#4ecdc4', bg: '#020c1e' },
  { id: 'parchment', label: 'Parchment', accent: '#d4a84a', bg: '#160e04' },
  { id: 'aurora',    label: 'Aurora',    accent: '#a78bfa', bg: '#09051a' },
];

const ThemeContext = createContext({ theme: 'noir', setTheme: () => {}, themes: THEMES });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('memoir-theme') || 'noir'
  );

  function setTheme(id) {
    setThemeState(id);
    localStorage.setItem('memoir-theme', id);
    if (id === 'noir') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', id);
    }
  }

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('memoir-theme') || 'noir';
    if (saved !== 'noir') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
