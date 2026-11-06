import { CircularProgress, Box } from '@mui/material';
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import { useAppState } from './state/AppState';

const ResultsPage = lazy(() => import('./pages/ResultsPage'));

function RequireResult({ children }: { children: ReactElement }) {
  const { result } = useAppState();
  return result ? children : <Navigate to="/xml-compare" replace />;
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
        <Route path="/xml-compare" element={<UploadPage />} />
        <Route
          path="/xml-compare/results"
          element={
            <RequireResult>
              <ResultsPage />
            </RequireResult>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
