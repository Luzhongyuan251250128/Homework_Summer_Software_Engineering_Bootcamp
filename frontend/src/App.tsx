import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ConfigPage from "./pages/ConfigPage";
import DashboardPage from "./pages/DashboardPage";
import DeveloperPage from "./pages/DeveloperPage";
import IterationPage from "./pages/IterationPage";
import LoginPage from "./pages/LoginPage";
import ReportEditorPage from "./pages/ReportEditorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/developers" element={<DeveloperPage />} />
        <Route path="/iterations/:id" element={<IterationPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/reports/:id" element={<ReportEditorPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
