import { useState, useEffect } from 'react';
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
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center group shrink-0">
            <img src="/logo.png" alt="Cyberscam Watchdog Network" className="h-16 w-auto object-contain" />
          </Link>

          <div className="hidden md:flex items-center gap-2 overflow-x-auto ml-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>


          <div className="flex items-center gap-2">
            <a
              href="https://endscams.org/donate"
              className="hidden md:flex items-center justify-center px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-bold text-base transition-colors shadow-sm ml-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate
            </a>
            <button
              onClick={toggleDarkMode}
              className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-8 h-8 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-8 h-8 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>
      </div>


      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg">
          <div className="px-6 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-5 py-4 rounded-lg font-bold text-lg transition-all ${
                  isActive(link.to)
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
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
              className="block px-5 py-4 rounded-lg font-bold text-lg text-center text-white bg-brand-500 hover:bg-brand-600 transition-colors shadow-sm mt-4"
            >
              Donate
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
