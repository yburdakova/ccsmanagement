import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import Logo from '../../assets/Logo.png';
import './MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  const userName = 'Yana Burdakova'; // временно

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/projects':
        return 'Manage Projects';
      case '/users':
        return 'Manage Users';
      case '/data':
        return 'Manage Data';
      case '/customers':
        return 'Manage Customers';    
      default:
        return '';
    }
  };

  const logout = () => {
    console.log("MainLayout: Logout is working");
    localStorage.clear();
    navigate('/');
  }
  

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="layout">
      <aside className="sidebar">
         <div className="logo">
          <img src={Logo} alt="Logo" />
        </div>
        <div className="navBox">
            <nav className="nav">
                <NavLink to="/dashboard" className="navItem">
                    <div className="navItem"><span className="gg-icon">dashboard</span> Dashboard</div>
                </NavLink>
                <NavLink to="/projects" className="navItem">
                    <div className="navItem"><span className="gg-icon">assignment_add</span> Manage Projects</div>
                </NavLink>
                <NavLink to="/users" className="navItem">
                    <div className="navItem"><span className="gg-icon">group_add</span> Manage Users</div>
                </NavLink>
                <NavLink to="/customers" className="navItem">
                    <div className="navItem"><span className="gg-icon">account_balance</span> Manage Customers</div>
                </NavLink>
                <NavLink to="/data" className="navItem">
                    <div className="navItem"><span className="gg-icon">table_edit</span> Manage Data</div>
                </NavLink>
                
            </nav>
            <div className="projectBox">
                <h4>Available Projects</h4>
                <div className="projectList">
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Prince Williams, 24</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span> CFS Alexandria, 25</div>
                    <div className="navItem"><span className="gg-icon">content_paste_search</span>IM Russell, 24</div>
                </div>
                
            </div>
        </div>

       
      </aside>

      <main className="main">
        <header className="header">
            <div className="timeBox">
                <div>{formatDate(time)}</div>
                <div>{formatTime(time)}</div>
            </div>
         
          <div className="pageTitle">{getPageTitle().toUpperCase()}</div>
          <div className="userBox">
            <div className="userName">{userName}</div>
            <button type="button" className="logoutBtn" onClick={logout}>
                <span className="gg-icon">logout</span>
            </button>
          </div>
          
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default MainLayout;
