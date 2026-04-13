import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Calendar, MessageSquare, MoreHorizontal } from 'lucide-react';

export const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const navItems = [
    { 
      path: '/dashboard', 
      icon: Home, 
      label: 'Inicio',
      exact: true
    },
    { 
      path: '/dashboard/my-case', 
      icon: FileText, 
      label: 'Mi Caso',
      exact: false
    },
    { 
      path: '/dashboard/appointments', 
      icon: Calendar, 
      label: 'Citas',
      exact: false
    },
    { 
      path: '/dashboard/messages', 
      icon: MessageSquare, 
      label: 'Mensajes',
      exact: false
    },
    { 
      path: '/dashboard/profile', 
      icon: MoreHorizontal, 
      label: 'Más',
      exact: false
    }
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the fixed nav + Android nav bar */}
      <div className="sm:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 16px))' }} />
      
      {/* Bottom Navigation - Navy Premium Theme */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-navy-secondary border-t border-gold-dark/20 shadow-premium sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center w-full h-full py-1 px-2 transition-all duration-200 touch-manipulation active:scale-95 ${
                  active 
                    ? 'text-gold-primary' 
                    : 'text-slate hover:text-gold-subtle'
                }`}
                data-testid={`bottom-nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                  active ? 'bg-gold-dark/20' : ''
                }`}>
                  <Icon className={`h-5 w-5 transition-transform duration-200 ${
                    active ? 'scale-110' : ''
                  }`} />
                  {/* Active indicator dot */}
                  {active && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-gold-primary rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 font-medium transition-all duration-200 ${
                  active ? 'text-gold-primary font-semibold' : ''
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNavBar;
