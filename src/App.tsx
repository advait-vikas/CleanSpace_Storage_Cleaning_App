import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analyze from './pages/Analyze';
import Clean from './pages/Clean';
import Applications from './pages/Applications';
import Files from './pages/Files';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <ErrorBoundary><Dashboard onNavigate={setCurrentPage} /></ErrorBoundary>;
      case 'analyze':
        return <ErrorBoundary><Analyze /></ErrorBoundary>;
      case 'clean':
        return <ErrorBoundary><Clean /></ErrorBoundary>;
      case 'applications':
        return <ErrorBoundary><Applications /></ErrorBoundary>;
      case 'files':
        return <ErrorBoundary><Files /></ErrorBoundary>;
      default:
        return <ErrorBoundary><Dashboard onNavigate={setCurrentPage} /></ErrorBoundary>;
    }
  };

  return (
    <ThemeProvider>
      <AppProvider>
        <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
          {renderPage()}
        </Layout>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
