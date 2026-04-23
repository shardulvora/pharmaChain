import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import BatchDetailPage from "./pages/BatchDetailPage";
import GeneratePage from "./pages/GeneratePage";
import AboutPage from "./pages/AboutPage";
import VerifyPage from "./pages/VerifyPage";
import DAOPanel from "./components/DAOPanel";

function App() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="page-content">
        <Routes>
          {/* Primary entry — land judges on verify immediately */}
          <Route path="/" element={<Navigate to="/verify" replace />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/batch/:id" element={<BatchDetailPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Role portals — wired to the most relevant working page per role */}
          <Route path="/admin" element={<DAOPanel />} />
          <Route path="/admin/*" element={<DAOPanel />} />
          <Route path="/manufacturer" element={<GeneratePage />} />
          <Route path="/manufacturer/*" element={<GeneratePage />} />
          <Route path="/distributor" element={<VerifyPage />} />
          <Route path="/distributor/*" element={<VerifyPage />} />

          {/* 404 fallback — never show blank page to judges */}
          <Route path="*" element={<Navigate to="/verify" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

