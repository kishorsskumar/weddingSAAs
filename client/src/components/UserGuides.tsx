import { useState } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Smartphone, BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OAK_COLORS = {
  primary: '#7C8B5D',
  accent: '#9AAF6C',
  dark: '#2D3A1F',
  light: '#F5F7F0',
  gold: '#B8A44C',
};

function addHeader(doc: jsPDF, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFillColor(124, 139, 93);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setFillColor(184, 164, 76);
  doc.rect(0, 35, pageWidth, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Portal', 20, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Employee Portal User Guide', pageWidth - 20, 22, { align: 'right' });
  
  doc.setTextColor(45, 58, 31);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 52);
  
  return 65;
}

function addFooter(doc: jsPDF, pageNum: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFillColor(154, 175, 108);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  
  doc.setTextColor(45, 58, 31);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  doc.text('Confidential', 20, pageHeight - 6);
}

function addSection(doc: jsPDF, y: number, title: string, content: string[]): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  
  doc.setFillColor(154, 175, 108);
  doc.rect(margin - 5, y - 5, 3, 20, 'F');
  
  doc.setTextColor(124, 139, 93);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 5, y + 5);
  
  y += 18;
  
  doc.setTextColor(45, 58, 31);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let stepCounter = 0;
  
  content.forEach((line) => {
    if (y > doc.internal.pageSize.getHeight() - 35) {
      addFooter(doc, 1);
      doc.addPage();
      y = 30;
    }
    
    if (line.startsWith('•')) {
      doc.setFillColor(154, 175, 108);
      doc.circle(margin + 3, y - 2, 1.5, 'F');
      const lines = doc.splitTextToSize(line.substring(2), maxWidth - 15);
      doc.setTextColor(45, 58, 31);
      doc.text(lines, margin + 10, y);
      y += lines.length * 6 + 4;
    } else if (line.startsWith('[STEP]')) {
      stepCounter++;
      const stepText = line.replace('[STEP]', '').trim();
      
      doc.setFillColor(124, 139, 93);
      doc.circle(margin + 8, y + 2, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(String(stepCounter), margin + 8, y + 4, { align: 'center' });
      
      doc.setTextColor(45, 58, 31);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(stepText, maxWidth - 30);
      doc.text(lines, margin + 20, y + 4);
      y += Math.max(lines.length * 6, 12) + 6;
    } else if (line === '') {
      y += 6;
    } else {
      const lines = doc.splitTextToSize(line, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 6 + 4;
    }
  });
  
  return y + 12;
}

function generateInstallGuide(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  let y = addHeader(doc, 'How to Install the Web App on Your Mobile');
  
  y = addSection(doc, y, 'Overview', [
    'The Employee Portal can be installed on your mobile phone as a web app (PWA). This allows you to access the portal quickly from your home screen, just like a regular app.',
    '',
    'This guide covers installation on both Android and iPhone devices.'
  ]);
  
  y = addSection(doc, y, 'Installing on Android (Chrome Browser)', [
    '[STEP] Open Chrome browser on your Android phone',
    '[STEP] Navigate to the portal website',
    '[STEP] Log in with your employee credentials',
    '[STEP] Tap the three-dot menu icon in the top-right corner',
    '[STEP] Select "Add to Home screen" or "Install app"',
    '[STEP] Enter a name for the app (e.g., "Oak Portal")',
    '[STEP] Tap "Add" or "Install"',
    '',
    'The app icon will now appear on your home screen for quick access.'
  ]);
  
  y = addSection(doc, y, 'Installing on iPhone (Safari Browser)', [
    '[STEP] Open Safari browser on your iPhone',
    '[STEP] Navigate to the portal website',
    '[STEP] Log in with your employee credentials',
    '[STEP] Tap the Share button (square with arrow pointing up)',
    '[STEP] Scroll down and tap "Add to Home Screen"',
    '[STEP] Edit the name if desired and tap "Add"',
    '',
    'The app icon will now appear on your home screen.'
  ]);
  
  addFooter(doc, 1);
  doc.addPage();
  y = 30;
  
  doc.setFillColor(124, 139, 93);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Web App Installation Guide', 20, 13);
  y = 35;
  
  y = addSection(doc, y, 'Benefits of Installing the Web App', [
    '• Quick access from your home screen without opening a browser',
    '• Full-screen experience without browser navigation bars',
    '• Faster loading times after initial installation',
    '• Works offline for viewing previously loaded data',
    '• Receive notifications (if enabled)'
  ]);
  
  y = addSection(doc, y, 'Troubleshooting', [
    '• If you don\'t see the "Add to Home Screen" option, make sure you\'re using the default browser (Chrome for Android, Safari for iPhone)',
    '• Clear your browser cache and try again if the option doesn\'t appear',
    '• Contact your manager or IT support if you continue to have issues'
  ]);
  
  y = addSection(doc, y, 'Need Help?', [
    'For technical issues or questions:',
    '• Contact your manager',
    '• Reach out to HR department',
    '• Email your support team'
  ]);
  
  addFooter(doc, 2);
  
  return doc;
}

function generatePortalGuide(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  let y = addHeader(doc, 'How to Login and Use the Employee Portal');
  
  y = addSection(doc, y, 'Getting Started', [
    'The Employee Portal is your central hub for managing leaves, viewing payroll, submitting expense claims, and more. This guide will help you navigate the portal effectively.'
  ]);
  
  y = addSection(doc, y, 'Logging In', [
    '[STEP] Open your browser and go to the portal website',
    '[STEP] Enter your registered email address',
    '[STEP] Enter your password (provided by HR during onboarding)',
    '[STEP] Click the "Sign In" button',
    '',
    'If you forget your password, contact your manager or HR to reset it.'
  ]);
  
  y = addSection(doc, y, 'Dashboard Overview', [
    'After logging in, you\'ll see your personal dashboard with:',
    '• Your current salary information',
    '• Leave balance and used leaves',
    '• Increment history',
    '• Profile information card',
    '• Recent activity summary'
  ]);
  
  y = addSection(doc, y, 'Managing Leaves', [
    'To request a leave:',
    '[STEP] Click on the "Leaves" tab',
    '[STEP] Click "Request Leave" button',
    '[STEP] Select the leave category (Casual, Sick, etc.)',
    '[STEP] Choose start and end dates',
    '[STEP] Add a reason for your leave',
    '[STEP] Click "Submit" to send for approval',
    '',
    'You can track the status of your leave requests in the same tab.'
  ]);
  
  addFooter(doc, 1);
  doc.addPage();
  y = 30;
  
  doc.setFillColor(124, 139, 93);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Portal Guide', 20, 13);
  y = 35;
  
  y = addSection(doc, y, 'Viewing Payroll & Salary Slips', [
    '[STEP] Click on the "Payroll" tab',
    '[STEP] View your payroll history with monthly breakdown',
    '[STEP] Click on any month to see detailed salary slip',
    '',
    'Your salary slip shows:',
    '• Monthly salary',
    '• Days worked',
    '• Deductions (if any)',
    '• Net pay amount'
  ]);
  
  y = addSection(doc, y, 'Submitting Expense Claims', [
    '[STEP] Click on the "Expenses" tab',
    '[STEP] Click "New Expense" button',
    '[STEP] Select expense category',
    '[STEP] Enter the expense date and amount',
    '[STEP] Add a description of the expense',
    '[STEP] Upload receipt/voucher (if required)',
    '[STEP] Submit for approval'
  ]);
  
  y = addSection(doc, y, 'Requesting Salary Advance', [
    '[STEP] Click on the "Advance" tab',
    '[STEP] Click "Request Advance"',
    '[STEP] Enter the amount needed',
    '[STEP] Select repayment duration',
    '[STEP] Provide reason for the advance',
    '[STEP] Submit for manager approval'
  ]);
  
  addFooter(doc, 2);
  doc.addPage();
  y = 30;
  
  doc.setFillColor(124, 139, 93);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Portal Guide', 20, 13);
  y = 35;
  
  y = addSection(doc, y, 'Updating Your Profile', [
    'Your profile information is managed by HR. If you need to update:',
    '• Contact details (phone, email)',
    '• Address',
    '• Emergency contact',
    '• Bank details',
    '',
    'Please contact your HR representative to make these changes.'
  ]);
  
  y = addSection(doc, y, 'Need Help?', [
    'For technical issues or questions about the portal:',
    '• Contact your manager',
    '• Reach out to HR department',
    '• Email your support team'
  ]);
  
  addFooter(doc, 3);
  
  return doc;
}

export function UserGuides() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (type: 'install' | 'portal') => {
    setDownloading(type);
    try {
      const doc = type === 'install' ? generateInstallGuide() : generatePortalGuide();
      const filename = type === 'install' 
        ? 'Oak_WebApp_Installation_Guide.pdf' 
        : 'Oak_Employee_Portal_Guide.pdf';
      doc.save(filename);
      toast({ title: "Download started!", description: `${filename} is being downloaded.` });
    } catch (error) {
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          User Guides
        </CardTitle>
        <CardDescription>Download helpful guides for using the Employee Portal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={() => handleDownload('install')}
          disabled={downloading !== null}
          data-testid="btn-download-install-guide"
        >
          {downloading === 'install' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smartphone className="h-4 w-4" />
          )}
          <div className="text-left">
            <div className="font-medium">Web App Installation Guide</div>
            <div className="text-xs text-muted-foreground">How to install on mobile</div>
          </div>
          <Download className="h-4 w-4 ml-auto" />
        </Button>
        
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={() => handleDownload('portal')}
          disabled={downloading !== null}
          data-testid="btn-download-portal-guide"
        >
          {downloading === 'portal' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BookOpen className="h-4 w-4" />
          )}
          <div className="text-left">
            <div className="font-medium">Employee Portal Guide</div>
            <div className="text-xs text-muted-foreground">How to login and use features</div>
          </div>
          <Download className="h-4 w-4 ml-auto" />
        </Button>
      </CardContent>
    </Card>
  );
}
