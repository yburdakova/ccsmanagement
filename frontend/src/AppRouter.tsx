import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import ProjectsPage from './pages/ProjectsPage/ProjectsPage';
import UsersPage from './pages/UsersPage/UsersPage';
import CustomersPage from './pages/CustomersPage/CustomersPage';
import LoginPage from './pages/LoginPage/LoginPage';


const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
