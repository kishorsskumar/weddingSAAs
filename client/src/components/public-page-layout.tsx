import { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicPageLayoutProps {
  title: string;
  children: ReactNode;
  showBackButton?: boolean;
}

export function PublicPageLayout({ title, children, showBackButton = true }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex-1">
      <div className="max-w-[800px] mx-auto px-6 py-12 sm:px-8 sm:py-16">
        {showBackButton && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">{title}</h1>
        <div className="prose prose-gray max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
