import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';

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
    { to: '/', label: 'Home' },
    { to: '/tracker', label: 'Scam Tracker' },
    { to: '/ftc-scams', label: 'Top Scams' },
    { to: '/education', label: 'Education' },
    { to: '/report', label: 'Report Scam' },
    { to: '/triage', label: 'Scam Checker' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity relative z-50">
            <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Cyberscam Watchdog Logo" className="h-28 -my-4 drop-shadow-md" />
          </div>
          </Link>


          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg font-medium text-lg transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>


          <div className="flex items-center gap-2">
            <a
              href="https://endscams.org/donate"
              className="hidden md:flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-colors shadow-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate
            </a>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              ) : (
                <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
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
                className={`block px-4 py-3 rounded-lg font-medium text-lg transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
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
