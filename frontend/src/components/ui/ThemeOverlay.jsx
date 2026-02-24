import { useTheme } from '../../hooks/useTheme.jsx';

const SIDE_MASK =
  'linear-gradient(to right, black 0%, black 10%, transparent 23%, transparent 77%, black 90%, black 100%)';

const OVERLAYS = {
  noir: {
    backgroundImage: "url('/noir-pattern.svg')",
    backgroundSize: '250px 250px',
    opacity: 0.55,
  },
  sakura: {
    backgroundImage: "url('/sakura-petals.svg')",
    backgroundSize: '260px 260px',
    opacity: 0.45,
  },
  ocean: {
    backgroundImage: "url('/ocean-drops.svg')",
    backgroundSize: '240px 240px',
    opacity: 0.50,
  },
  parchment: {
    backgroundImage: "url('/parchment-leaves.svg')",
    backgroundSize: '250px 250px',
    opacity: 0.48,
  },
  aurora: {
    backgroundImage: "url('/aurora-stars.svg')",
    backgroundSize: '240px 240px',
    opacity: 0.52,
  },
};

export default function ThemeOverlay() {
  const { theme } = useTheme();
  const style = OVERLAYS[theme];
  if (!style) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        backgroundRepeat: 'repeat',
        maskImage: SIDE_MASK,
        WebkitMaskImage: SIDE_MASK,
        ...style,
      }}
    />
  );
}
