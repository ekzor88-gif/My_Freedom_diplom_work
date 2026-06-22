import { useState, useEffect } from 'react';
import {
  Code,
  Database,
  Sun,
  Moon,
  User,
  Lock
} from 'lucide-react';

const Settings = () => {
  const [defaultTheme, setDefaultTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'dark';
  });

  const [username, setUsername] = useState('Василий');
  const [password, setPassword] = useState('password123');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync settings page state with layout theme changes (e.g. from header button)
  useEffect(() => {
    const handleThemeChange = () => {
      setDefaultTheme(localStorage.getItem('app-theme') || 'dark');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const changeTheme = (newTheme) => {
    setDefaultTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-2xl font-bold">Настройки системы</h2>
        <p className="text-muted-foreground">Настройка параметров интерфейса, данных и учетной записи</p>
      </div>

      {/* Database and Orchestrator Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3 font-bold">
            <Database size={20} className="text-info" />
            База данных (PostgreSQL)
          </div>
          <p className="text-sm text-muted-foreground">
            Статус: <span className="text-success font-medium">Подключено</span>
          </p>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-2">
            <span>a1-postgres1.alem.ai</span>
            <span>Latency: 12ms</span>
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3 font-bold">
            <Code size={20} className="text-warning" />
            Оркестратор (n8n Webhooks)
          </div>
          <p className="text-sm text-muted-foreground">
            Статус: <span className="text-success font-medium">Активен</span>
          </p>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-2">
            <span>a1-n8n1.alem.ai</span>
            <span>Latency: 28ms</span>
          </div>
        </div>
      </div>

      {/* User Settings Form */}
      <form onSubmit={handleSave} className="glass-card p-8 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <User size={20} className="text-primary" />
          <h3 className="font-bold text-lg">Настройки пользователя</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Имя пользователя</label>
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <User size={16} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
                required
              />
            </div>
          </div>
          
          <div className="relative">
            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Пароль</label>
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-all"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" className="btn-primary w-full md:w-auto">Сохранить изменения</button>
          {saveSuccess && (
            <span className="text-sm text-success font-semibold animate-pulse">Настройки успешно сохранены!</span>
          )}
        </div>
      </form>

      {/* Global Interface/Theme Configuration */}
      <div className="glass-card p-8">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Sun size={20} className="text-primary" />
          Общие настройки
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Тема по умолчанию</label>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={() => changeTheme('dark')}
                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  defaultTheme === 'dark'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'
                }`}
              >
                <Moon size={16} /> Темная тема
              </button>
              <button
                type="button"
                onClick={() => changeTheme('light')}
                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  defaultTheme === 'light'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'
                }`}
              >
                <Sun size={16} /> Светлая тема
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
