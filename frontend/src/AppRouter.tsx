import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import ProjectsPage from './pages/ProjectsPage/ProjectsPage';
import UsersPage from './pages/UsersPage/UsersPage';
import CustomersPage from './pages/CustomersPage/CustomersPage';
import LoginPage from './pages/LoginPage/LoginPage';
import MainLayout from './layouts/MainLayout/MainLayout';
import DataPage from './pages/DataPage/DataPage';
import ProductionSheetPage from './pages/ProductionSheetPage/ProductionSheetPage';
import InventoryItemsPage from './pages/InventoryItemsPage/InventoryItemsPage';
import MetricsPage from './pages/MetricsPage/MetricsPage';
import ProductionSheetsPage from './pages/ProductionSheetsPage/ProductionSheetsPage';
import AdminMetricsPage from './pages/AdminMetricsPage/AdminMetricsPage';
import RequireAuth from './components/RequireAuth/RequireAuth';


const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          element={(
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          )}
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/production-sheet" element={<ProductionSheetPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/admin-metrics" element={<AdminMetricsPage />} />
          <Route path="/production-sheets" element={<ProductionSheetsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/inventory-items" element={<InventoryItemsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
