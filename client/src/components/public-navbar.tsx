import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, User, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import atbottLogo from "@/assets/atbott-logo.png";

export function PublicNavbar() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const navLinks = [
    { href: "/#product", label: "Product" },
    { href: "/#features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/#demo", label: "Demo" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href.replace("/#", "/"));
  };

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.includes("#")) {
      const element = document.getElementById(href.split("#")[1]);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center">
            <img src={atbottLogo} alt="AtBott" className="h-10 object-contain" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => handleNavClick(link.href)}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "text-primary"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {user.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link href="/#demo">
                  <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/5">
                    Book Demo
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800">
                    Start Free Trial
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    isActive(link.href)
                      ? "text-primary bg-primary/5"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 mt-2">
                {user ? (
                  <>
                    <div className="px-3 py-2 text-sm font-medium text-gray-900">
                      Hi, {user.name}
                    </div>
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link href="/login">
                      <Button variant="ghost" size="sm" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link href="/#demo">
                      <Button variant="outline" size="sm" className="w-full border-primary text-primary">
                        Book Demo
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button size="sm" className="w-full bg-gradient-to-r from-green-700 to-emerald-700">
                        Start Free Trial
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
