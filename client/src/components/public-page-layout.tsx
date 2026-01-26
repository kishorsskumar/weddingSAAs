import { ReactNode } from "react";

interface PublicPageLayoutProps {
  title: string;
  children: ReactNode;
}

export function PublicPageLayout({ title, children }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[800px] mx-auto px-6 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">{title}</h1>
        <div className="prose prose-gray max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
