import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { getDisplayName } from '../utils/userUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Globe, LogOut, Menu, User, Settings, UserCircle } from 'lucide-react';

export const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const isAdLanding = searchParams.get('landing') === 'publicidad';

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-navy-primary/95 backdrop-blur-md border-b border-gold-dark/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
              alt="URPE Logo" 
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          {!isAdLanding && (
            <div className="hidden md:flex items-center space-x-8">
              {user && (
                <>
                  <button 
                    onClick={() => {
                      if (user.role === 'admin') {
                        navigate('/admin');
                      } else {
                        navigate('/dashboard');
                      }
                    }}
                    className="text-gold-subtle hover:text-gold-primary transition-colors font-medium" 
                    data-testid="nav-panel"
                  >
                    {t('nav.panel')}
                  </button>
                  <Link to="/messages" className="text-gold-subtle hover:text-gold-primary transition-colors font-medium" data-testid="nav-messages">
                    {t('nav.messages')}
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Right Side Actions */}
          {!isAdLanding && (
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary" data-testid="language-selector">
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-navy-secondary border-navy-light/30">
                  <DropdownMenuItem onClick={() => changeLanguage('en')} className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer" data-testid="lang-en">
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('es')} className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer" data-testid="lang-es">
                    Español
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="relative h-10 w-10 rounded-full bg-gradient-to-br from-gold-primary to-gold-dark flex items-center justify-center text-navy-primary font-bold shadow-gold hover:ring-2 hover:ring-gold-dark/30 transition-all"
                      data-testid="user-menu"
                    >
                      {user.profileImage ? (
                        <img 
                          src={user.profileImage} 
                          alt={user.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">
                          {user.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 bg-navy-secondary border-navy-light/30 shadow-premium">
                    {/* User Info Header */}
                    <div className="px-3 py-3 bg-gradient-to-br from-gold-dark/10 to-transparent rounded-t-lg border-b border-navy-light/20">
                      <p className="text-sm font-medium text-gold-subtle">{user.name}</p>
                      <p className="text-xs text-slate mt-0.5">{user.email}</p>
                    </div>
                    
                    {/* Menu Items */}
                    <div className="py-1">
                      <DropdownMenuItem 
                        onClick={() => navigate('/profile')} 
                        className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer py-2.5"
                      >
                        <UserCircle className="h-4 w-4 mr-2 text-gold-dark" />
                        {t('userMenu.editProfile')}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        onClick={() => navigate('/settings')} 
                        className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer py-2.5"
                      >
                        <Settings className="h-4 w-4 mr-2 text-gold-dark" />
                        {t('userMenu.settings')}
                      </DropdownMenuItem>
                      
                      <div className="border-t border-navy-light/20 my-1"></div>
                      
                      <DropdownMenuItem 
                        onClick={handleSignOut} 
                        className="text-error hover:bg-error/10 cursor-pointer py-2.5" 
                        data-testid="sign-out-btn"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('nav.signOut')}
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={() => navigate('/auth')} className="bg-gold-primary text-navy-primary hover:bg-gold-dark font-semibold" data-testid="nav-signin-btn">
                  {t('auth.signIn')}
                </Button>
              )}
              
              {/* Dashboard Link for authenticated users */}
              {user && (
                <Button onClick={() => navigate('/dashboard')} className="hidden md:inline-flex bg-gold-primary text-navy-primary hover:bg-gold-dark font-semibold" data-testid="nav-dashboard-btn">
                  Dashboard
                </Button>
              )}

              {/* Mobile Menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" className="text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary" data-testid="mobile-menu">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-navy-secondary border-navy-light/30 w-48">
                    <DropdownMenuItem 
                      onClick={() => {
                        if (user.role === 'admin') {
                          navigate('/admin');
                        } else {
                          navigate('/dashboard');
                        }
                      }}
                      className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer"
                    >
                      {t('nav.panel')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/messages')} 
                      className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer"
                    >
                      {t('nav.messages')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
