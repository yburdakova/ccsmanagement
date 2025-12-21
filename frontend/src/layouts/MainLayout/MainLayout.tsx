import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import Logo from '../../assets/Logo.png';
import './MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isProductionOnly = user?.role === 2;

  const userName = user ? `${user.first_name} ${user.last_name}` : '';

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
      case '/production-sheet':
        return 'Production Sheet';
      default:
        return '';
    }
  };

  const logout = () => {
    console.log("MainLayout: Logout is working");
    localStorage.clear();
    navigate('/');
  }

  useEffect(() => {
    if (isProductionOnly && location.pathname !== '/production-sheet') {
      navigate('/production-sheet');
    }
  }, [isProductionOnly, location.pathname, navigate]);
  

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
                {isProductionOnly ? (
                  <NavLink to="/production-sheet" className="navItem">
                    <div className="navItem">
                      <svg
                        aria-hidden="true"
                        height="24"
                        viewBox="0 -960 960 960"
                        width="24"
                        fill="#000000"
                      >
                        <path d="M600-160q-134 0-227-93t-93-227q0-133 93-226.5T600-800q133 0 226.5 93.5T920-480q0 134-93.5 227T600-160Zm0-80q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Zm91-91 57-57-108-108v-144h-80v177l131 132ZM80-600v-80h160v80H80ZM40-440v-80h200v80H40Zm40 160v-80h160v80H80Zm520-200Z"/>
                      </svg>
                      Production Sheet
                    </div>
                  </NavLink>
                ) : (
                  <>
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
                  </>
                )}
            </nav>
            {user?.role === 1 && (
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
            )}
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
