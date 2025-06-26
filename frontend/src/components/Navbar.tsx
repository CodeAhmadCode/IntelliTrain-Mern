// src/components/Navbar.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronRight, User, LogOut } from 'lucide-react';
import { logout } from '../utils/auth';

interface NavbarProps {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, setIsAuthenticated }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', href: '/#home' },
    { name: 'Models', href: '/#models' },
    { name: 'Projects', href: '/#projects' },
    { name: 'About', href: '/#about' },
  ];

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    navigate('/');
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        isScrolled ? 'bg-space-black/80 backdrop-blur-md py-3' : 'bg-transparent py-5'
      } border-b border-white/10`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo/Home Link */}
          <Link to="/" className="text-xl font-bold text-white">
            IntelliTrain
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link, i) => (
              <motion.div
                key={link.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
              >
                <Link
                  to={link.href}
                  className="text-sm uppercase tracking-widest hover:text-glow transition-all duration-300 relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-space-white group-hover:w-full transition-all duration-300"></span>
                </Link>
              </motion.div>
            ))}

            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center text-sm uppercase tracking-widest hover:text-glow transition-all duration-300 relative group"
                >
                  Dashboard
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-space-white group-hover:w-full transition-all duration-300"></span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center text-sm uppercase tracking-widest hover:text-glow transition-all duration-300 relative group"
                >
                  Logout
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-space-white group-hover:w-full transition-all duration-300"></span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center text-sm uppercase tracking-widest hover:text-glow transition-all duration-300 relative group"
              >
                Login
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-space-white group-hover:w-full transition-all duration-300"></span>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-space-white p-2 focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ 
          height: mobileMenuOpen ? 'auto' : 0,
          opacity: mobileMenuOpen ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        className="md:hidden overflow-hidden bg-space-black/90 backdrop-blur-md"
      >
        <div className="px-4 pt-2 pb-4 grid grid-cols-1 gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="flex items-center py-3 px-4 rounded-lg hover:bg-white/5 transition-colors duration-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{link.name}</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          ))}

          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center py-3 px-4 rounded-lg hover:bg-white/5 transition-colors duration-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="h-5 w-5 mr-2" />
                <span>Dashboard</span>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center py-3 px-4 rounded-lg hover:bg-white/5 transition-colors duration-300 text-left w-full"
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span>Logout</span>
                <ChevronRight className="h-4 w-4 ml-auto" />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center py-3 px-4 rounded-lg hover:bg-white/5 transition-colors duration-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Login</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          )}
        </div>
      </motion.div>
    </nav>
  );
};

export default Navbar;