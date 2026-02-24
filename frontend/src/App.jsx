import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { MemoirProvider } from './context/MemoirContext.jsx';
import ThemeSwitcher from './components/ui/ThemeSwitcher.jsx';
import ThemeOverlay from './components/ui/ThemeOverlay.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';

const LandingPage  = lazy(() => import('./pages/LandingPage.jsx'));
const UploadPage   = lazy(() => import('./pages/UploadPage.jsx'));
const LoadingPage  = lazy(() => import('./pages/LoadingPage.jsx'));
const MemoirPage   = lazy(() => import('./pages/MemoirPage.jsx'));
const HistoryPage  = lazy(() => import('./pages/HistoryPage.jsx'));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"                      element={<LandingPage />} />
        <Route path="/upload"                element={<UploadPage />} />
        <Route path="/loading/:sessionId"    element={<LoadingPage />} />
        <Route path="/memoir/:sessionId"     element={<MemoirPage />} />
        <Route path="/history"              element={<HistoryPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MemoirProvider>
        <ThemeProvider>
        <ThemeSwitcher />
        <ThemeOverlay />
        <Suspense fallback={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', color: 'var(--accent-gold)',
            fontFamily: 'var(--font-serif)', fontSize: '1.2rem', letterSpacing: '0.1em',
          }}>
            Loading…
          </div>
        }>
          <AnimatedRoutes />
        </Suspense>
        </ThemeProvider>
      </MemoirProvider>
    </BrowserRouter>
  );
}
