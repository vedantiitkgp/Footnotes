import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme.jsx';
import './ThemeSwitcher.css';

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  const current = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="theme-sw">
      {/* Popup palette */}
      {open && (
        <div className="theme-sw__popup" role="listbox" aria-label="Choose theme">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`theme-sw__option ${t.id === theme ? 'theme-sw__option--active' : ''}`}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              role="option"
              aria-selected={t.id === theme}
            >
              <span
                className="theme-sw__dot"
                style={{ background: t.accent, boxShadow: `0 0 10px ${t.accent}80` }}
              />
              <span className="theme-sw__name">{t.label}</span>
              {t.id === theme && <span className="theme-sw__check">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        className={`theme-sw__btn ${open ? 'theme-sw__btn--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Change theme"
        title={`Theme: ${current.label}`}
      >
        <span
          className="theme-sw__orb"
          style={{ background: `radial-gradient(circle at 35% 35%, ${current.accent}ee, ${current.bg})` }}
        />
        <span className="theme-sw__btn-label">Theme</span>
      </button>

      {/* Backdrop */}
      {open && <div className="theme-sw__bd" onClick={() => setOpen(false)} />}
    </div>
  );
}
