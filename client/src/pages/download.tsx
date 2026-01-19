import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Smartphone, Apple, Chrome, Download, CheckCircle2, ArrowRight } from "lucide-react";
import logo from "@assets/OAK_1_1768844040105.jpg";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsMac(/macintosh|mac os x/.test(userAgent) && !('ontouchend' in document));
    setIsWindows(/windows/.test(userAgent));

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-12">
          <img src={logo} alt="Oakstreet Events" className="h-24 md:h-32 mx-auto mb-8" />
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Install the app on your device for quick access anytime
          </p>
        </div>

        {isInstalled && (
          <Card className="max-w-md mx-auto mb-8 border-green-500 bg-green-50">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="text-green-800 font-medium">App is already installed on this device!</span>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {deferredPrompt && (
            <Card className="border-2 border-[#5B8C51]/20 bg-[#5B8C51]/5 shadow-xl hover:shadow-2xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Chrome className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Install Now</CardTitle>
                    <CardDescription>One-click install</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Click the button below to instantly install the app on your device.
                </p>
                <Button onClick={handleInstall} className="w-full bg-[#5B8C51] hover:bg-[#4a7342]" size="lg">
                  <Download className="mr-2 h-5 w-5" />
                  Install App
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-2 border-gray-200 bg-gray-50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Monitor className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Desktop (Windows/Mac)</CardTitle>
                  <CardDescription>Chrome or Edge browser</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                  <span>Open <strong>www.oakstreetevent.com</strong> in Chrome or Edge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                  <span>Click the <strong>install icon</strong> in the address bar (or menu → "Install app")</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                  <span>The app will appear on your desktop like any other program</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 bg-gray-50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-100 rounded-xl">
                  <Apple className="h-8 w-8 text-gray-700" />
                </div>
                <div>
                  <CardTitle className="text-xl">iPhone / iPad</CardTitle>
                  <CardDescription>Safari browser</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                  <span>Open <strong>www.oakstreetevent.com</strong> in Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                  <span>Tap the <strong>Share button</strong> (box with arrow)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                  <span>Scroll and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                  <span>Tap <strong>"Add"</strong> - done!</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 bg-gray-50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Smartphone className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Android</CardTitle>
                  <CardDescription>Chrome browser</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                  <span>Open <strong>www.oakstreetevent.com</strong> in Chrome</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                  <span>Tap the <strong>3-dot menu</strong> (top right)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                  <span>Tap <strong>"Install app"</strong> or "Add to Home screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#5B8C51] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                  <span>Tap <strong>"Install"</strong> - done!</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">Already have an account?</p>
          <Button 
            variant="outline" 
            size="lg"
            className="border-[#5B8C51] text-[#5B8C51] hover:bg-[#5B8C51] hover:text-white"
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <div className="text-center mt-16 text-gray-400 text-sm">
          <p>&copy; 2025 Oakstreet Events. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
