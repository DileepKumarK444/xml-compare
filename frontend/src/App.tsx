import { CircularProgress, Box } from '@mui/material';
import { lazy, Suspense, useContext, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FormatCtx, FORMATS, type Format } from './formats';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ValidatorPage from './pages/ValidatorPage';
import { useAppState } from './state/AppState';

const ResultsPage = lazy(() => import('./pages/ResultsPage'));

function RequireResult({ children }: { children: ReactElement }) {
  const { result } = useAppState();
  const base = FORMATS[useContext(FormatCtx)].base;
  return result ? children : <Navigate to={base} replace />;
}

/** Marks which tool a route belongs to, so shared pages pick the right store and labels. */
function Scope({ format, children }: { format: Format; children: ReactElement }) {
  return <FormatCtx.Provider value={format}>{children}</FormatCtx.Provider>;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      }
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        {(['xml', 'json', 'text'] as const).flatMap((f) => [
          <Route
            key={f}
            path={FORMATS[f].base}
            element={
              <Scope format={f}>
                <UploadPage />
              </Scope>
            }
          />,
          <Route
            key={`${f}-results`}
            path={`${FORMATS[f].base}/results`}
            element={
              <Scope format={f}>
                <RequireResult>
                  <ResultsPage />
                </RequireResult>
              </Scope>
            }
          />,
        ])}
        <Route path="/xml-validator" element={<ValidatorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
