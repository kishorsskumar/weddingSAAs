import { ReactNode } from "react";
import { PublicNavbar } from "./public-navbar";
import { PublicFooter } from "./public-footer";

interface PublicLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export function PublicLayout({ children, showNavbar = true, showFooter = true }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {showNavbar && <PublicNavbar />}
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <PublicFooter />}
    </div>
  );
}
