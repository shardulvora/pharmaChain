import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import BatchDetailPage from "./pages/BatchDetailPage";
import GeneratePage from "./pages/GeneratePage";
import AboutPage from "./pages/AboutPage";

function App() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/batch/:id" element={<BatchDetailPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
