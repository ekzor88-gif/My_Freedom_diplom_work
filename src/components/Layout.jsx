import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Box, 
  Sparkles, 
  FileText, 
  Settings, 
  Menu, 
  X,
  User,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';

const SidebarItem = ({ to, icon: Icon, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => 
      `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`
    }
  >
    <Icon size={22} />
    <span>{label}</span>
  </NavLink>
);

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'dark';
  });

  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('app-theme') || 'dark';
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
      }
    };
    syncTheme();
    window.addEventListener('theme-changed', syncTheme);
    return () => window.removeEventListener('theme-changed', syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app-theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} border-r border-white/5 bg-card/30 backdrop-blur-xl transition-all duration-300 flex flex-col`}>
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <Sparkles size={20} />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                СмартСнаб
              </span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-white/5 rounded-md text-muted-foreground"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <SidebarItem to="/" icon={LayoutDashboard} label={sidebarOpen ? "Дашборд" : ""} />
          <SidebarItem to="/ai-audit" icon={Sparkles} label={sidebarOpen ? "AI Аналитика" : ""} />
          <SidebarItem to="/inventory" icon={Box} label={sidebarOpen ? "Склад" : ""} />
          <SidebarItem to="/orders" icon={FileText} label={sidebarOpen ? "Заявки" : ""} />
          <SidebarItem to="/settings" icon={Settings} label={sidebarOpen ? "Настройки" : ""} />
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
              В
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-sm font-medium">Василий</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-card/10 backdrop-blur-md z-10">
          <h1 className="text-lg font-semibold">Система предиктивного управления</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-white/5 rounded-full text-muted-foreground transition-colors"
              title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="h-8 w-[1px] bg-white/5"></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <User size={18} />
              <span>Профиль</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
