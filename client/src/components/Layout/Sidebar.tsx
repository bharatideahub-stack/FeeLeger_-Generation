import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, ArrowLeftRight, Settings,
  Upload, History, BookOpen, Layers, Download, ClipboardList,
  ChevronRight, GraduationCap, Trash2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: '',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    ]
  },
  {
    title: 'Fee Management',
    items: [
      { to: '/students', label: 'Students', icon: <Users size={16} /> },
      { to: '/fee-structure', label: 'Fee Structure', icon: <FileText size={16} /> },
      { to: '/transactions', label: 'Transactions', icon: <ArrowLeftRight size={16} /> },
      { to: '/adjustments', label: 'Adjustments', icon: <Settings size={16} /> },
    ]
  },
  {
    title: 'Fee Ledger',
    items: [
      { to: '/student-ledger', label: 'Student Ledger', icon: <BookOpen size={16} /> },
      { to: '/bulk-generation', label: 'Bulk Generation', icon: <Layers size={16} /> },
      { to: '/generated-ledgers', label: 'Generated Ledgers', icon: <Download size={16} /> },
    ]
  },
  {
    title: 'Data Management',
    items: [
      { to: '/import-excel', label: 'Import Excel', icon: <Upload size={16} /> },
      { to: '/import-history', label: 'Import History', icon: <History size={16} /> },
    ]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const sections: NavSection[] = user?.role === 'superadmin'
    ? navSections.map(section => section.title === 'Data Management'
        ? { ...section, items: [...section.items, { to: '/reset-data', label: 'Reset Data', icon: <Trash2 size={16} /> }] }
        : section)
    : navSections;

  return (
    <aside className="w-64 min-h-screen bg-[#1e3a8a] flex flex-col">
      {/* Logo / Header */}
      <div className="px-5 py-5 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Fee Ledger</div>
            <div className="text-blue-300 text-xs">Generator</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="sidebar-section">{section.title}</p>
            )}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="px-4 py-4 border-t border-blue-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'A'}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.fullName || user?.username}</div>
            <div className="text-blue-300 text-xs capitalize">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-blue-300 hover:text-white transition-colors py-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
