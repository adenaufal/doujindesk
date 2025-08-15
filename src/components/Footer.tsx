import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  FileText,
  Settings,
  MapPin,
  Ticket,
  DollarSign,
  Users,
  Map,
  Bell
} from 'lucide-react';

const Footer: React.FC = () => {
  const footerLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/apply', label: 'Apply', icon: FileText },
    { to: '/manage', label: 'Manage', icon: Settings },
    { to: '/booths', label: 'Booths', icon: MapPin },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    { to: '/financial', label: 'Financial', icon: DollarSign },
    { to: '/staff', label: 'Staff', icon: Users },
    { to: '/guide', label: 'Guide', icon: Map },
    { to: '/notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 lg:col-span-1">
            <h3 className="text-lg font-semibold text-foreground mb-4">DoujinDesk</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Complete PWA for doujin/comic convention management. Manage events, booths, tickets, and more.
            </p>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h4 className="text-md font-medium text-foreground mb-4">Quick Links</h4>
            <div className="grid grid-cols-2 gap-2">
              {footerLinks.slice(0, 5).map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 p-2 rounded-md hover:bg-accent"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Management */}
          <div className="col-span-1">
            <h4 className="text-md font-medium text-foreground mb-4">Management</h4>
            <div className="grid grid-cols-1 gap-2">
              {footerLinks.slice(5).map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 p-2 rounded-md hover:bg-accent"
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="col-span-1">
            <h4 className="text-md font-medium text-foreground mb-4">Features</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Offline-first architecture</li>
              <li>• Multi-currency support</li>
              <li>• Real-time updates</li>
              <li>• Role-based access</li>
              <li>• PWA capabilities</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
               © 2025 DoujinDesk. All rights reserved.
             </div>
            <div className="flex flex-wrap gap-4">
              {footerLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                  title={label}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;