"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Clock, Menu, X, CurrencyIcon, LogOut, Lock, Mail, CreditCard } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: Home },
  { label: 'Link History', href: '/admin/link-history', icon: Clock },
  { label: 'Bulk Payment', href: '/admin/bulk-payment', icon: CreditCard },
  { label: 'Update Password', href: '/admin/update-password', icon: Lock },
  { label: 'Update Email', href: '/admin/update-email', icon: Mail },
]

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // prevent background scroll on mobile drawer
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/admin/login");
  };

  const drawerVariants = {
    hidden: { x: "-100%" },
    visible: { x: "0%" },
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active
                ? "bg-green-50 text-green-600"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
          >
            <Icon
              className={`mr-3 h-5 w-5 transition-colors ${active ? "text-green-600" : "text-gray-400 hover:text-gray-500"
                }`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const LogoutFooter = ({ onClick }: { onClick?: () => void }) => (
    <div className="px-4 py-4 border-t">
      <button
        onClick={() => {
          onClick?.();
          handleLogout();
        }}
        className="flex items-center w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        <LogOut className="mr-3 h-5 w-5 text-gray-400 hover:text-gray-500 transition-colors" />
        Logout
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <div className="md:hidden fixed inset-x-0 top-0 z-40 h-12 bg-white border-b flex items-center px-4 shadow-sm">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 text-gray-700" />
        </button>
        <div className="ml-4 flex items-center">
          <img src="/logo.jpg" alt="Logo" className="h-6 w-6 object-contain rounded-full" />
          <span className="ml-2 text-lg font-semibold">ShareMitra</span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 h-screen bg-white border-r">
          <div className="h-16 flex items-center justify-center border-b">
            <img src="/logo.jpg" alt="Logo" className="h-8 w-8 object-contain rounded-full" />
            <span className="ml-2 text-xl font-semibold">ShareMitra</span>
          </div>

          {/* nav links */}
          <NavLinks />

          {/* logout at bottom */}
          <LogoutFooter />
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 backdrop-blur-sm bg-black/30 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Sliding Drawer */}
            <motion.aside
              className="fixed inset-y-0 left-0 z-40 w-64 bg-white border-r flex flex-col"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={drawerVariants}
              transition={{ type: "tween", duration: 0.2 }}
            >
              <div className="h-12 flex items-center justify-between px-4 border-b">
                <div className="flex items-center">
                  <img src="/logo.jpg" alt="Logo" className="h-6 w-6 object-contain rounded-full" />
                  <span className="ml-2 text-lg font-semibold">ShareMitra</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6 text-gray-700" />
                </button>
              </div>

              {/* nav links */}
              <NavLinks onClick={() => setOpen(false)} />

              {/* logout at bottom */}
              <LogoutFooter onClick={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
