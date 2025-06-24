import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import ProjectsPage from './pages/ProjectsPage/ProjectsPage';
import UsersPage from './pages/UsersPage/UsersPage';
import CustomersPage from './pages/CustomersPage/CustomersPage';
import LoginPage from './pages/LoginPage/LoginPage';
import MainLayout from './layouts/MainLayout/MainLayout';
import DataPage from './pages/DataPage/DataPage';


const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route path="/" element={<MainLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="data" element={<DataPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
