import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileArchive, FileText } from "lucide-react";

export default function DownloadFiles() {
  const handleDownloadArchive = () => {
    window.open('/api/download/client-portal-starter', '_blank');
  };

  const handleDownloadGuide = () => {
    window.open('/api/download/client-portal-guide', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-800 mb-2">Client Portal Starter Files</h1>
          <p className="text-gray-600">Download the files you need to build your client portal</p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-green-600" />
                Starter Files Archive
              </CardTitle>
              <CardDescription>
                Contains all essential files: UI components, database schema, WhatsApp service, styling, and config files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 mb-4 space-y-1">
                <li>• 60+ UI components (buttons, dialogs, forms, etc.)</li>
                <li>• Database schema (schema.ts)</li>
                <li>• WhatsApp service (whatsapp-service.ts)</li>
                <li>• Styling files (index.css, postcss.config.js)</li>
                <li>• Config files (tsconfig.json, vite.config.ts)</li>
              </ul>
              <Button onClick={handleDownloadArchive} className="w-full bg-green-600 hover:bg-green-700">
                <Download className="h-4 w-4 mr-2" />
                Download Archive (.tar.gz)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Development Guide
              </CardTitle>
              <CardDescription>
                Step-by-step guide for setting up your client portal project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDownloadGuide} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Guide (.md)
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-800 text-lg">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900 space-y-2">
              <p><strong>1.</strong> Create a new Replit project (Node.js template)</p>
              <p><strong>2.</strong> Upload the archive file to the new project</p>
              <p><strong>3.</strong> In the Shell, run: <code className="bg-amber-100 px-1 rounded">tar -xzvf client-portal-starter.tar.gz</code></p>
              <p><strong>4.</strong> Move files to their appropriate locations</p>
              <p><strong>5.</strong> Follow the development guide to build your portal</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
