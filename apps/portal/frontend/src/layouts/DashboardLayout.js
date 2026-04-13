import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { getDisplayName, getUserInitials } from '../utils/userUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { RegisterModal } from '../components/RegisterModal';
import { BottomNavBar } from '../components/BottomNavBar';
import { 
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  MessageSquare,
  Video,
  Award,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Lock,
  Bell,
  BookOpen,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Globe,
  Briefcase,
} from 'lucide-react';

export const DashboardLayout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [previousPath, setPreviousPath] = useState(location.pathname);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  // Estado de colapso de categorías - todas expandidas por defecto
  const [collapsedCategories, setCollapsedCategories] = useState({
    recursos: false,
    herramientas: false,
    gestion: false,
  });

  const toggleCategory = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Check user state
  const userState = user?.userState || 'U1';
  const isVisitor = userState === 'U1'; // Only completed eligibility test
  const isRegistered = userState === 'U3'; // Has email/password
  
  // For Pay As You Advance pages, allow access only to U3 users
  const canAccessPayAsYouAdvance = isRegistered && user && !user.role; // Not an admin/staff

  // Detect route changes and show loading animation
  useEffect(() => {
    if (location.pathname !== previousPath) {
      setIsNavigating(true);
      setSidebarOpen(false); // Close sidebar on mobile when navigating
      
      // Show loading for 1 second
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setPreviousPath(location.pathname);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, previousPath]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  const menuCategories = {
    principal: {
      label: 'Principal',
      icon: LayoutDashboard,
      collapsible: false,
      items: [
        {
          id: 'dashboard',
          icon: LayoutDashboard,
          label: t('dashboard.nav.home'),
          path: '/dashboard',
          unlocked: true,
        },
        {
          id: 'case',
          icon: FileText,
          label: t('dashboard.nav.myCase'),
          path: '/dashboard/my-case',
          unlocked: canAccessPayAsYouAdvance,
          badge: 'client',
          requiresRegistration: true,
        },
      ]
    },
    recursos: {
      label: 'Recursos',
      icon: BookOpen,
      collapsible: true,
      items: [
        {
          id: 'legal-library',
          icon: BookOpen,
          label: t('library.title'),
          path: '/dashboard/legal-library',
          unlocked: isRegistered,
          requiresRegistration: true,
        },
        {
          id: 'webinars',
          icon: Video,
          label: t('webinars.title'),
          path: '/dashboard/webinars',
          unlocked: true,
        },
        {
          id: 'success-stories',
          icon: Award,
          label: t('stories.title'),
          path: '/dashboard/success-stories',
          unlocked: true,
        },
      ]
    },
    herramientas: {
      label: 'Herramientas',
      icon: Settings,
      collapsible: true,
      items: [
        {
          id: 'eligibility',
          icon: FileText,
          label: t('dashboard.nav.eligibility'),
          path: '/dashboard/success-calculator',
          unlocked: true,
        },
        {
          id: 'timeline',
          icon: Clock,
          label: t('timeline.title'),
          path: '/dashboard/timeline-predictor',
          unlocked: isRegistered,
          requiresRegistration: true,
        },
      ]
    },
    gestion: {
      label: 'Gestión',
      icon: Briefcase,
      collapsible: true,
      items: [
        {
          id: 'documents',
          icon: FileText,
          label: t('dashboard.nav.documents'),
          path: '/dashboard/documents',
          unlocked: canAccessPayAsYouAdvance,
          badge: 'client',
          requiresRegistration: true,
        },
        {
          id: 'payments',
          icon: CreditCard,
          label: t('dashboard.nav.payments'),
          path: '/dashboard/payments',
          unlocked: canAccessPayAsYouAdvance,
          badge: 'client',
          requiresRegistration: true,
        },
        {
          id: 'appointments',
          icon: Calendar,
          label: t('dashboard.nav.appointments'),
          path: '/dashboard/appointments',
          unlocked: true,
        },
        {
          id: 'messages',
          icon: MessageSquare,
          label: t('dashboard.nav.messages'),
          path: '/dashboard/messages',
          unlocked: true,
        },
      ]
    }
  };

  const CategoryHeader = ({ category, categoryId }) => {
    const isCollapsed = collapsedCategories[categoryId];
    const CategoryIcon = category.icon;

    if (!category.collapsible) {
      return (
        <div className="px-3 py-2 text-xs font-semibold text-slate uppercase tracking-wider">
          {category.label}
        </div>
      );
    }

    return (
      <button
        onClick={() => toggleCategory(categoryId)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate uppercase tracking-wider hover:text-gold-subtle transition-colors"
      >
        <div className="flex items-center space-x-2">
          <CategoryIcon className="h-4 w-4" />
          <span>{category.label}</span>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    );
  };

  const MenuItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    const isLocked = !item.unlocked;

    const handleClick = (e) => {
      e.preventDefault();
      
      if (isLocked && item.requiresRegistration) {
        // Show registration modal
        setShowRegisterModal(true);
        setSidebarOpen(false);
      } else if (!isLocked) {
        navigate(item.path);
        setSidebarOpen(false);
      }
    };

    return (
      <button
        onClick={handleClick}
        className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-gold-primary text-navy-primary'
            : isLocked
            ? 'text-slate hover:bg-navy-light/10 cursor-not-allowed'
            : 'text-gold-subtle hover:bg-gold-dark/10 hover:text-gold-primary'
        }`}
        data-testid={`nav-${item.id}`}
      >
        <div className="flex items-center space-x-3 flex-1">
          <item.icon className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium text-left">{item.label}</span>
        </div>
        {isLocked && <Lock className="h-4 w-4 ml-auto" />}
        {item.badge === 'client' && !isLocked && (
          <Badge className="bg-success text-white text-xs px-2 py-0.5 ml-auto">
            {t('dashboard.badge.client')}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-navy-primary text-gold-subtle">
      {/* Loading Overlay with Logo */}
      {isNavigating && (
        <div className="fixed inset-0 bg-navy-primary/98 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-6 animate-fade-in">
            {/* URPE Logo with pulse animation */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-gold-dark/20 animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center">
                <img 
                  src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
                  alt="URPE Logo" 
                  className="h-32 w-auto animate-bounce-slow"
                />
              </div>
            </div>
            
            {/* Loading text */}
            <div className="space-y-2">
              <p className="text-lg text-gold-primary font-semibold font-display">
                {t('dashboard.loading')}
              </p>
              <div className="flex justify-center space-x-1">
                <div className="w-2 h-2 bg-gold-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gold-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gold-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Top Bar - Navy Premium */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-navy-primary/95 backdrop-blur-md border-b border-gold-dark/20 z-50">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left: Logo + Menu Toggle */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary"
              data-testid="menu-toggle"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            <Link to="/dashboard" className="flex items-center space-x-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
                alt="URPE Logo" 
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-4">
            {/* User Status Badge */}
            {isRegistered ? (
              <Badge className="bg-success text-white hidden sm:flex">
                {t('dashboard.status.client')}
              </Badge>
            ) : (
              <Badge className="bg-gold-dark/30 text-gold-primary border border-gold-dark/30 hidden sm:flex">
                {t('dashboard.status.visitor')}
              </Badge>
            )}

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary relative"
              data-testid="notifications-button"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-gold-primary rounded-full"></span>
            </Button>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gold-subtle hover:text-gold-primary hover:bg-navy-secondary">
                  <Globe className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-navy-secondary border-navy-light/30">
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer">
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('es')} className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer">
                  Español
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu with Profile Photo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 hover:opacity-80 transition-opacity" data-testid="user-menu">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-medium text-gold-subtle">{getDisplayName(user)}</span>
                    <span className="text-xs text-slate">{user?.email}</span>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold-primary to-gold-dark flex items-center justify-center text-navy-primary font-bold text-lg shadow-gold ring-2 ring-gold-dark/30 hover:ring-gold-primary/60 transition-all">
                    {getUserInitials(user)}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-navy-secondary border-navy-light/30 shadow-premium">
                <div className="px-3 py-3 bg-gradient-to-br from-gold-dark/10 to-transparent rounded-t-lg border-b border-navy-light/20">
                  <p className="text-sm font-medium text-gold-subtle">{getDisplayName(user)}</p>
                  <p className="text-xs text-slate mt-0.5">{user?.email}</p>
                </div>
                <DropdownMenuItem 
                  onClick={() => navigate('/dashboard/profile')} 
                  className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer py-2.5 mt-1"
                >
                  <User className="h-4 w-4 mr-2 text-gold-dark" />
                  Editar Perfil
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/dashboard/change-password')} 
                  className="text-gold-subtle hover:bg-navy-light/20 hover:text-gold-primary cursor-pointer py-2.5"
                >
                  <Lock className="h-4 w-4 mr-2 text-gold-dark" />
                  Cambiar Contraseña
                </DropdownMenuItem>
                <div className="my-1 h-px bg-navy-light/20"></div>
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="text-error hover:bg-error/10 cursor-pointer py-2.5" 
                  data-testid="sign-out-btn"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sidebar - Navy Premium */}
      <div
        className={`fixed top-16 left-0 bottom-0 w-64 bg-navy-secondary border-r border-gold-dark/20 transform transition-transform duration-300 z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full overflow-y-auto p-4">
          <nav className="space-y-4">
            {Object.entries(menuCategories).map(([categoryId, category]) => (
              <div key={categoryId} className="space-y-1">
                <CategoryHeader category={category} categoryId={categoryId} />
                {!collapsedCategories[categoryId] && (
                  <div className="space-y-1 ml-1">
                    {category.items.map((item) => (
                      <MenuItem key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Upgrade CTA for Visitors */}
          {isVisitor && (
            <div className="mt-8 p-4 bg-gradient-to-br from-gold-dark/20 to-transparent border border-gold-dark/30 rounded-lg">
              <h3 className="font-display font-semibold text-sm mb-2 text-gold-subtle">¡Desbloquea Todo!</h3>
              <p className="text-xs text-slate mb-3">
                Regístrate para acceder a todas las funcionalidades
              </p>
              <Button
                onClick={() => setShowRegisterModal(true)}
                size="sm"
                className="w-full bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold"
                data-testid="upgrade-cta"
              >
                Registrarme Ahora
              </Button>
            </div>
          )}

          {/* Help Link */}
          <div className="mt-6 pt-6 border-t border-gold-dark/20">
            <button
              onClick={() => navigate('/dashboard/help')}
              className="w-full flex items-center space-x-3 px-4 py-3 text-slate hover:text-gold-primary transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">{t('dashboard.nav.help')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 pt-16">
        <main className="min-h-screen bg-navy-primary">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-primary/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Register Modal */}
      <RegisterModal 
        isOpen={showRegisterModal} 
        onClose={() => setShowRegisterModal(false)} 
      />

      {/* Bottom Navigation Bar - Solo visible en móvil */}
      <BottomNavBar />
    </div>
  );
};
