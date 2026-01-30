import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
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
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'analyze':
        return <Analyze />;
      case 'clean':
        return <Clean />;
      case 'applications':
        return <Applications />;
      case 'files':
        return <Files />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
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
