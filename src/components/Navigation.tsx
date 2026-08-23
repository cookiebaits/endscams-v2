import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X, Sun, Moon, FileSearch, TrendingUp, GraduationCap, Megaphone, ShieldCheck, MonitorPlay } from 'lucide-react';

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    setDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navLinks = [
    { to: '/', label: 'Home', shortLabel: 'Home' },
    { to: '/tracker', label: 'Scam Tracker', shortLabel: 'Tracker', icon: FileSearch },
    { to: '/ftc-scams', label: 'Top Scams', shortLabel: 'Top Scams', icon: TrendingUp },
    { to: '/education', label: 'Education', shortLabel: 'Education', icon: GraduationCap },
    { to: '/stream-safety', label: 'Streamer Safety', shortLabel: 'Streamer Safety', icon: MonitorPlay },
    { to: '/report', label: 'Report Scam', shortLabel: 'Report', icon: Megaphone },
    { to: '/triage', label: 'Scam Checker', shortLabel: 'Checker', icon: ShieldCheck },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="w-full px-2 lg:px-4">
        <div className="flex items-center justify-between h-20">

          {/* Left section: Logo */}
          <div className="flex flex-1 justify-start items-center h-full">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity relative z-50 w-[180px] md:w-[220px] lg:w-[280px] xl:w-[340px] 2xl:w-[420px] shrink-0 h-20">
              <img src="/logo.png" alt="Cyberscam Watchdog Logo" className="absolute -top-[5px] left-0 h-[4.5rem] md:h-[5.5rem] lg:h-[6.5rem] xl:h-[7.5rem] 2xl:h-[8.5rem] max-w-none drop-shadow-md origin-top-left object-contain" />
            </Link>
          </div>

          {/* Center section: Nav Links */}
          <div className="hidden md:flex items-center justify-center gap-0.5 lg:gap-1 xl:gap-2 flex-nowrap shrink whitespace-nowrap">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1 lg:gap-1.5 px-1.5 lg:px-2 xl:px-3 py-2 rounded-lg font-medium text-[11px] lg:text-sm xl:text-base transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {link.icon && <link.icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />}
                <span className="hidden 2xl:inline">{link.label}</span>
                <span className="2xl:hidden">{link.shortLabel}</span>
              </Link>
            ))}
          </div>

          {/* Right section: Actions */}
          <div className="flex flex-1 justify-end items-center gap-1 lg:gap-2 shrink-0">
            <a
              href="https://endscams.org/donate"
              className="hidden md:flex items-center justify-center px-3 xl:px-4 py-1.5 xl:py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xs xl:text-sm transition-colors shadow-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate
            </a>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 xl:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 xl:w-5 xl:h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <Moon className="w-4 h-4 xl:w-5 xl:h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </div>


      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-base transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {link.icon && <link.icon className="w-5 h-5" />}
                {link.label}
              </Link>
            ))}
            <a
              href="https://endscams.org/donate"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 rounded-lg font-bold text-sm text-center text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm mt-2"
            >
              Donate
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
