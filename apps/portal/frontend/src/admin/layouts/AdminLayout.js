import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Badge } from '../../components/ui/badge';
import {
  LayoutDashboard,
  Users,
  UserCog,
  LogOut,
  Menu,
  X,
  Settings,
  HeartHandshake,
  Video,
  FileText,
  TrendingUp,
  Clock,
  Search,
  Activity,
  Calendar,
  User,
  DollarSign,
  Lock,
  FolderOpen,
  Award,
  UserPlus,
  Layers,
  Package,
  ClipboardList,
  Eye,
  FlaskConical,
  CreditCard,
  GraduationCap,
  Sparkles,
  Briefcase,
  BookOpen,
  Wallet,
  Contact,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { GlobalSearch } from '../components/GlobalSearch';
import { NotificationsPanel } from '../components/NotificationsPanel';

export const AdminLayout = () => {
  const { admin, signOut, hasPermission } = useAdminAuth();
  const { getMenuItems, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_sidebar_groups');
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('admin_sidebar_groups', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Redirect acreditador to visa-cases if accessing unauthorized routes
  useEffect(() => {
    if (admin?.role === 'acreditador' && !location.pathname.startsWith('/admin/visa-cases')) {
      navigate('/admin/visa-cases', { replace: true });
    }
  }, [admin, location.pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  // Icon mapping for menu items
  const iconMap = {
    'dashboard': LayoutDashboard,
    'visa-cases': HeartHandshake,
    'users': Users,
    'staff-management': UserCog,
    'webinars': Video,
    'legal-library': FileText,
    'comparator': TrendingUp,
    'timeline-management': Clock,
    'audit-logs': Activity,
    'eligibility': FileText,
    'test-eligibility': FlaskConical,
    'payments': DollarSign,
    'files': FolderOpen,
    'leads': UserPlus,
    'stage-management': Layers,
    'deliverable-management': Package,
    'uscis-forms': ClipboardList,
    'learning': GraduationCap,
    'learning-admin': Sparkles
  };

  // Get menu items from RBAC system
  const backendMenuItems = getMenuItems();

  // Role gates for backend-provided items that we want to restrict beyond the
  // RBAC permission set.
  const role = admin?.role;
  const isSuperAdmin = role === 'super_admin';
  const isAdminOrSuper = role === 'admin' || role === 'super_admin';
  const backendItemShowOverrides = {
    users: isAdminOrSuper, // Usuarios: solo admin y super_admin
  };

  // Map backend menu items to frontend format with icons + apply overrides.
  const menuItems = backendMenuItems.map(item => ({
    ...item,
    icon: iconMap[item.id] || FileText,
    show: item.id in backendItemShowOverrides ? backendItemShowOverrides[item.id] : item.show,
  }));

  // Add Payments and Files menu items (temporary - should come from backend)
  const paymentsMenuItem = {
    id: 'payments',
    label: 'Pagos',
    path: '/admin/payments',
    icon: DollarSign,
    show: true
  };

  const filesMenuItem = {
    id: 'files',
    label: 'Archivos',
    path: '/admin/files',
    icon: FolderOpen,
    show: true
  };

  const leadsMenuItem = {
    id: 'leads',
    label: 'Leads',
    path: '/admin/leads',
    icon: UserPlus,
    show: true
  };

  const stageManagementMenuItem = {
    id: 'stage-management',
    label: 'Gestión de Etapas',
    path: '/admin/stage-management',
    icon: Layers,
    show: isAdmin || isSuperAdmin
  };

  const deliverableManagementMenuItem = {
    id: 'deliverable-management',
    label: 'Entregables/Documentos',
    path: '/admin/deliverable-management',
    icon: Package,
    show: isSuperAdmin
  };

  const masterCaseMenuItem = {
    id: 'master-case',
    label: 'Caso Maestro',
    path: '/admin/master-case',
    icon: Settings,
    show: isSuperAdmin
  };

  const successStoriesMenuItem = {
    id: 'success-stories',
    label: 'Casos de Éxito',
    path: '/admin/success-stories',
    icon: Award,
    show: isSuperAdmin
  };

  const paymentAuthMenuItem = {
    id: 'payment-authorizations',
    label: 'Autorizaciones de Pago',
    path: '/admin/payment-authorizations',
    icon: CreditCard,
    show: isAdmin()
  };

  const uscisFormsMenuItem = {
    id: 'uscis-forms',
    label: 'Formularios USCIS',
    path: '/admin/uscis-forms',
    icon: ClipboardList,
    show: true // Visible para todos los usuarios del dashboard
  };

  const testEligibilityMenuItem = {
    id: 'test-eligibility',
    label: 'Pruebas Elegibilidad',
    path: '/admin/test-eligibility',
    icon: FlaskConical,
    show: true // Visible para todos los usuarios del dashboard
  };

  const proposalMenuItem = {
    id: 'proposal',
    label: 'Redacciones AI',
    path: '/admin/proposal',
    icon: Eye,
    show: true
  };

  const classicCasesMenuItem = {
    id: 'classic-cases',
    label: 'Gestión Clásica',
    path: '/admin/classic-cases',
    icon: ClipboardList,
    show: true
  };

  const learningMenuItem = {
    id: 'learning',
    label: 'Aprendizaje',
    path: '/admin/learning',
    icon: GraduationCap,
    show: true // todo el staff puede consumir
  };

  const learningAdminMenuItem = {
    id: 'learning-admin',
    label: 'Gestión de Aprendizaje',
    path: '/admin/learning-admin',
    icon: Sparkles,
    show: hasPermission('manage_learning') || isAdmin()
  };

  const allMenuItems = admin?.role === 'acreditador'
    ? menuItems
    : [...menuItems, paymentsMenuItem, filesMenuItem, uscisFormsMenuItem, testEligibilityMenuItem, leadsMenuItem, stageManagementMenuItem, deliverableManagementMenuItem, masterCaseMenuItem, successStoriesMenuItem, paymentAuthMenuItem, proposalMenuItem, classicCasesMenuItem, learningMenuItem, learningAdminMenuItem];
  // Dedupe by id (backend can return items also added manually here, e.g. learning)
  const dedupedItems = Array.from(
    new Map(allMenuItems.map((item) => [item.id, item])).values()
  );
  const visibleItems = dedupedItems.filter((item) => item.show);

  const MENU_GROUPS = [
    { type: 'item', id: 'dashboard' },
    {
      type: 'group',
      id: 'cases',
      label: 'Casos',
      icon: Briefcase,
      children: ['visa-cases', 'classic-cases', 'timeline-management'],
    },
    {
      type: 'group',
      id: 'clients',
      label: 'Clientes & Leads',
      icon: Contact,
      children: ['users', 'leads'],
    },
    { type: 'item', id: 'staff-management' },
    {
      type: 'group',
      id: 'finance',
      label: 'Finanzas',
      icon: Wallet,
      children: ['payments', 'payment-authorizations'],
    },
    {
      type: 'group',
      id: 'tools',
      label: 'Herramientas IA',
      icon: Sparkles,
      children: ['test-eligibility', 'eligibility', 'proposal', 'comparator', 'uscis-forms'],
    },
    {
      type: 'group',
      id: 'content',
      label: 'Contenido & Aprendizaje',
      icon: BookOpen,
      children: ['webinars', 'legal-library', 'learning', 'learning-admin'],
    },
    {
      type: 'group',
      id: 'config',
      label: 'Configuración',
      icon: Settings,
      children: ['stage-management', 'deliverable-management', 'master-case', 'success-stories'],
    },
    { type: 'item', id: 'files' },
    { type: 'item', id: 'audit-logs' },
  ];

  const itemMap = Object.fromEntries(visibleItems.map((item) => [item.id, item]));
  const knownIds = new Set();
  MENU_GROUPS.forEach((g) => {
    if (g.type === 'item') knownIds.add(g.id);
    else g.children.forEach((c) => knownIds.add(c));
  });
  const leftoverItems = visibleItems.filter((item) => !knownIds.has(item.id));

  const renderItem = (item, nested = false) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.id}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`group flex items-center space-x-3 ${nested ? 'px-3 py-2' : 'px-4 py-3.5'} rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 text-yellow-500 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50 hover:translate-x-1'
        }`}
      >
        <div className={`${nested ? 'p-1' : 'p-1.5'} rounded-lg transition-colors ${
          isActive ? 'bg-yellow-500/20' : 'bg-gray-800/50 group-hover:bg-gray-800'
        }`}>
          <Icon className={nested ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <span className={`font-medium ${nested ? 'text-sm' : ''}`}>{item.label}</span>
        {isActive && (
          <div className="ml-auto w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
        )}
      </Link>
    );
  };

  const renderGroup = (group) => {
    const groupChildren = group.children
      .map((id) => itemMap[id])
      .filter(Boolean);
    if (groupChildren.length === 0) return null;
    const hasActive = groupChildren.some((c) => c.path === location.pathname);
    const isOpen = hasActive || !!expandedGroups[group.id];
    const GroupIcon = group.icon;
    return (
      <div key={group.id} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={isOpen}
          className={`w-full group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            hasActive
              ? 'text-yellow-500'
              : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <div className={`p-1.5 rounded-lg transition-colors ${
            hasActive ? 'bg-yellow-500/20' : 'bg-gray-800/50 group-hover:bg-gray-800'
          }`}>
            <GroupIcon className="h-5 w-5" />
          </div>
          <span className="font-medium flex-1 text-left">{group.label}</span>
          {hasActive && !isOpen && (
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 opacity-70" />
          ) : (
            <ChevronRight className="h-4 w-4 opacity-70" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 pl-3 border-l border-gray-700/50 space-y-1">
            {groupChildren.map((item) => renderItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Bar - Simplificado */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border-b border-gray-800 backdrop-blur-md z-40">
        <div className="flex items-center justify-between h-full px-4">
          {/* Logo + Menu Toggle */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            
            <Link to="/admin/dashboard" className="flex items-center group">
              <img
                src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png"
                alt="URPE Logo"
                className="h-8 transition-transform group-hover:scale-105"
              />
            </Link>
          </div>

          {/* User Menu with Profile Photo */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-medium text-white">{admin?.name}</span>
                    <span className="text-xs text-gray-400">{admin?.email}</span>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-black font-bold text-lg shadow-lg ring-2 ring-yellow-500/30 hover:ring-yellow-500/60 transition-all">
                    {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-700 shadow-xl">
                <div className="px-3 py-3 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-t-lg border-b border-gray-700">
                  <p className="text-sm font-medium text-white">{admin?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{admin?.email}</p>
                  <p className="text-xs text-yellow-500 mt-1">{admin?.role?.replace('_', ' ')}</p>
                </div>
                <DropdownMenuItem 
                  onClick={() => navigate('/admin/profile')} 
                  className="text-gray-300 hover:bg-gray-800 cursor-pointer py-2.5 mt-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  Editar Perfil
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/admin/change-password')} 
                  className="text-gray-300 hover:bg-gray-800 cursor-pointer py-2.5"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Cambiar Contraseña
                </DropdownMenuItem>
                <div className="my-1 h-px bg-gray-700"></div>
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="text-red-400 hover:bg-red-500/10 cursor-pointer py-2.5"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Sidebar - Con Scroll */}
      <aside
        className={`fixed left-0 top-16 bottom-0 w-64 bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800 z-30 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        {/* Navegación con scroll */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          {admin?.role === 'acreditador' ? (
            visibleItems.map((item) => renderItem(item))
          ) : (
            <>
              {MENU_GROUPS.map((g) => {
                if (g.type === 'item') {
                  const item = itemMap[g.id];
                  if (!item) return null;
                  return renderItem(item);
                }
                return renderGroup(g);
              })}
              {leftoverItems.length > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-800 space-y-1">
                  {leftoverItems.map((item) => renderItem(item))}
                </div>
              )}
            </>
          )}
        </nav>
        
        {/* Sidebar Footer - Fijo al fondo, sin bloquear */}
        <div className="flex-shrink-0 p-4 m-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Sistema</p>
          <p className="text-sm text-white font-semibold">URPE Admin v1.0</p>
          <p className="text-xs text-gray-400 mt-1">Todos los sistemas operativos</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 pt-16 min-h-screen bg-white relative z-10">
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Global Search */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};