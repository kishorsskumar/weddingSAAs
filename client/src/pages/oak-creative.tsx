import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Trash2, 
  FileDown, 
  FileImage, 
  Presentation,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Edit3,
  Copy,
  Palette,
  Type,
  ImageIcon,
  Grid3X3,
  LayoutGrid,
  FileText,
  Download,
  Eye,
  Save,
  ArrowLeft,
  Upload,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import type { Presentation as PresentationType, PresentationSlide, SlideImage, PresentationAsset } from "@shared/schema";

const SLIDE_CATEGORIES = [
  "Welcome Board",
  "Entrance Arch",
  "Mandap",
  "Stage Backdrop",
  "Haldi Decor",
  "Mehendi Decor",
  "Reception",
  "Sangeet",
  "Photo Booth",
  "Table Setting",
  "Ceiling Decor",
  "Lighting"
];

const THEMES = [
  { value: "traditional", label: "Kerala Traditional" },
  { value: "royal", label: "Royal Wedding" },
  { value: "modern", label: "Modern Minimalist" },
  { value: "rustic", label: "Rustic Charm" },
  { value: "beach", label: "Beach Wedding" },
  { value: "garden", label: "Garden Party" }
];

interface SlideWithImages extends PresentationSlide {
  images: SlideImage[];
}

interface PresentationFull extends PresentationType {
  slides: SlideWithImages[];
}

export default function OakCreative() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPresentation, setSelectedPresentation] = useState<string | null>(null);
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
  const [showNewPresentationDialog, setShowNewPresentationDialog] = useState(false);
  const [showNewSlideDialog, setShowNewSlideDialog] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPresentation, setNewPresentation] = useState({
    title: "",
    clientName: "",
    theme: "traditional",
    eventType: "wedding"
  });
  const [newSlide, setNewSlide] = useState({
    slideType: "category",
    title: "",
    category: "",
    layout: "options-grid"
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(SLIDE_CATEGORIES[0]);
  const [uploadName, setUploadName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState<'slides' | 'assets' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: presentations = [] } = useQuery<PresentationType[]>({
    queryKey: ["/api/presentations"],
  });

  const { data: presentationFull } = useQuery<PresentationFull>({
    queryKey: [`/api/presentations/${selectedPresentation}/full`],
    enabled: !!selectedPresentation,
  });

  const { data: assets = [] } = useQuery<PresentationAsset[]>({
    queryKey: ["/api/presentation-assets"],
  });

  // Mutations
  const createPresentationMutation = useMutation({
    mutationFn: async (data: typeof newPresentation) => {
      const res = await apiRequest("POST", "/api/presentations", data);
      return res.json() as Promise<PresentationType>;
    },
    onSuccess: (result: PresentationType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/presentations"] });
      setSelectedPresentation(result.id);
      setShowNewPresentationDialog(false);
      setNewPresentation({ title: "", clientName: "", theme: "traditional", eventType: "wedding" });
      toast({ title: "Presentation created" });
    },
  });

  const deletePresentationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/presentations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presentations"] });
      setSelectedPresentation(null);
      setSelectedSlide(null);
      toast({ title: "Presentation deleted" });
    },
  });

  const createSlideMutation = useMutation({
    mutationFn: async (data: typeof newSlide) => {
      const res = await apiRequest("POST", `/api/presentations/${selectedPresentation}/slides`, data);
      return res.json() as Promise<PresentationSlide>;
    },
    onSuccess: (result: PresentationSlide) => {
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/${selectedPresentation}/full`] });
      setSelectedSlide(result.id);
      setShowNewSlideDialog(false);
      setNewSlide({ slideType: "category", title: "", category: "", layout: "options-grid" });
      toast({ title: "Slide created" });
    },
  });

  const deleteSlideMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/slides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/${selectedPresentation}/full`] });
      setSelectedSlide(null);
      toast({ title: "Slide deleted" });
    },
  });

  const addImageToSlideMutation = useMutation({
    mutationFn: async ({ slideId, imageUrl, optionLabel }: { slideId: string; imageUrl: string; optionLabel: string }) => {
      await apiRequest("POST", `/api/slides/${slideId}/images`, { imageUrl, optionLabel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/${selectedPresentation}/full`] });
      toast({ title: "Image added to slide" });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/slide-images/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/${selectedPresentation}/full`] });
      toast({ title: "Image removed" });
    },
  });

  const currentSlide = presentationFull?.slides.find(s => s.id === selectedSlide);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      await apiRequest("POST", "/api/oaksy/generate-presentation", { 
        prompt: aiPrompt, 
        presentationId: selectedPresentation 
      });
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/${selectedPresentation}/full`] });
      toast({ title: "Presentation generated with AI!" });
      setShowAiDialog(false);
      setAiPrompt("");
    } catch (error) {
      toast({ title: "AI generation coming soon", description: "This feature will be available in the next update", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const loadImageAsBase64 = async (url: string): Promise<string> => {
    try {
      // Use server proxy to fetch images (handles CORS for external URLs like DALL-E)
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }
      const data = await response.json();
      return data.data;
    } catch (proxyError) {
      console.error("Proxy failed, trying direct load:", proxyError);
      // Fallback: try direct loading (for local/same-origin images)
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          } else {
            reject(new Error("Failed to get canvas context"));
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
      });
    }
  };

  const handleExportPPT = async () => {
    if (!presentationFull) return;
    
    toast({ title: "Generating PowerPoint...", description: "Loading images, this may take a moment" });
    
    try {
      const pptxgen = await import("pptxgenjs");
      const pptx = new pptxgen.default();
      
      // Set presentation properties
      pptx.author = "Event Planner";
      pptx.title = presentationFull.title;
      pptx.subject = `Wedding Proposal for ${presentationFull.clientName || "Client"}`;
      pptx.company = "Event Planner";
      
      // Brand colors
      const oakGreen = "6B9937";
      const darkGreen = "4A7A25";
      const gold = "C9A961";
      
      // Cover slide
      const coverSlide = pptx.addSlide();
      coverSlide.background = { color: oakGreen };
      
      // Gold accent bar at bottom
      coverSlide.addShape("rect", {
        x: 0, y: 5.2, w: "100%", h: 0.3,
        fill: { color: gold }
      });
      
      // Title
      coverSlide.addText(presentationFull.title, {
        x: 0, y: 2, w: "100%", h: 1,
        fontSize: 44, bold: true, color: "FFFFFF",
        align: "center", valign: "middle"
      });
      
      // Client name
      if (presentationFull.clientName) {
        coverSlide.addText(`For: ${presentationFull.clientName}`, {
          x: 0, y: 3, w: "100%", h: 0.6,
          fontSize: 24, color: "FFFFFF",
          align: "center", valign: "middle"
        });
      }
      
      // Branding
      coverSlide.addText("", {
        x: 0, y: 4.8, w: "100%", h: 0.4,
        fontSize: 14, color: "FFFFFF",
        align: "center", valign: "middle"
      });

      // Category slides
      for (const slide of presentationFull.slides) {
        const pptSlide = pptx.addSlide();
        pptSlide.background = { color: "FFFFFF" };
        
        // Header with brand green
        pptSlide.addShape("rect", {
          x: 0, y: 0, w: "100%", h: 1.2,
          fill: { color: oakGreen }
        });
        
        // Gold accent under header
        pptSlide.addShape("rect", {
          x: 0, y: 1.2, w: "100%", h: 0.08,
          fill: { color: gold }
        });
        
        // Slide title
        pptSlide.addText(slide.title || slide.category || "Slide", {
          x: 0, y: 0.3, w: "100%", h: 0.8,
          fontSize: 32, bold: true, color: "FFFFFF",
          align: "center", valign: "middle"
        });
        
        // Branding in corner
        pptSlide.addText("", {
          x: 8, y: 0.1, w: 2, h: 0.3,
          fontSize: 10, color: "FFFFFF",
          align: "right"
        });
        
        // Text content if available
        let contentY = 1.5;
        if (slide.content && typeof slide.content === 'object' && (slide.content as any).text) {
          pptSlide.addText((slide.content as any).text, {
            x: 0.5, y: contentY, w: 9, h: 0.8,
            fontSize: 14, color: "404040",
            align: "left", valign: "top"
          });
          contentY += 1;
        }
        
        // Images
        if (slide.images && slide.images.length > 0) {
          const cols = Math.min(slide.images.length, 3);
          const imgWidth = 2.8;
          const imgHeight = 2.1;
          const startX = (10 - (cols * imgWidth + (cols - 1) * 0.3)) / 2;
          
          for (let index = 0; index < slide.images.length; index++) {
            const img = slide.images[index];
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (imgWidth + 0.3);
            const y = contentY + row * (imgHeight + 0.6);
            
            try {
              // Load image as base64 via proxy
              const imgData = await loadImageAsBase64(img.imageUrl);
              pptSlide.addImage({
                data: imgData,
                x: x, y: y, w: imgWidth, h: imgHeight,
                rounding: true
              });
              
              // Label under image
              pptSlide.addText(img.optionLabel || `Option ${index + 1}`, {
                x: x, y: y + imgHeight + 0.05, w: imgWidth, h: 0.35,
                fontSize: 11, color: darkGreen, bold: true,
                align: "center", valign: "top"
              });
            } catch (err) {
              console.error("Failed to load image:", err);
              // Placeholder rectangle
              pptSlide.addShape("rect", {
                x: x, y: y, w: imgWidth, h: imgHeight,
                fill: { color: "F0F4EB" },
                line: { color: oakGreen, width: 1 }
              });
              pptSlide.addText("Image", {
                x: x, y: y + imgHeight / 2 - 0.2, w: imgWidth, h: 0.4,
                fontSize: 12, color: oakGreen,
                align: "center", valign: "middle"
              });
            }
          }
        }
      }
      
      // Thank you slide
      const thankYouSlide = pptx.addSlide();
      thankYouSlide.background = { color: oakGreen };
      
      // Gold accents
      thankYouSlide.addShape("rect", {
        x: 0, y: 0, w: "100%", h: 0.15,
        fill: { color: gold }
      });
      thankYouSlide.addShape("rect", {
        x: 0, y: 5.35, w: "100%", h: 0.15,
        fill: { color: gold }
      });
      
      thankYouSlide.addText("Thank You", {
        x: 0, y: 1.8, w: "100%", h: 1,
        fontSize: 48, bold: true, color: "FFFFFF",
        align: "center", valign: "middle"
      });
      
      // Gold line
      thankYouSlide.addShape("rect", {
        x: 4, y: 2.9, w: 2, h: 0.04,
        fill: { color: gold }
      });
      
      thankYouSlide.addText("", {
        x: 0, y: 3.2, w: "100%", h: 0.6,
        fontSize: 24, color: "FFFFFF",
        align: "center", valign: "middle"
      });
      
      thankYouSlide.addText("Contact us for your dream event", {
        x: 0, y: 3.8, w: "100%", h: 0.5,
        fontSize: 16, color: "FFFFFF",
        align: "center", valign: "middle"
      });
      
      // Save the file
      await pptx.writeFile({ fileName: `${presentationFull.title || "presentation"}.pptx` });
      toast({ title: "PowerPoint exported!", description: "Your presentation has been downloaded" });
    } catch (error) {
      console.error("PPT export error:", error);
      toast({ title: "Export failed", description: "Please try again", variant: "destructive" });
    }
  };

  const handleUploadAsset = async (file: File) => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      // 1. Get signed upload URL
      const uploadRes = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await uploadRes.json();
      
      // 2. Upload file to signed URL
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      // 3. Finalize upload to get permanent URL
      const finalizeRes = await apiRequest("PUT", "/api/objects/finalize", { uploadURL });
      const { objectPath } = await finalizeRes.json();
      
      // 4. Create asset record in database
      await apiRequest("POST", "/api/presentation-assets", {
        name: uploadName || file.name.replace(/\.[^/.]+$/, ""),
        category: uploadCategory,
        imageUrl: objectPath,
        thumbnailUrl: objectPath,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/presentation-assets"] });
      toast({ title: "Asset uploaded successfully!" });
      setShowUploadDialog(false);
      setUploadName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Main presentation list view
  if (!selectedPresentation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f7f2] via-[#eef2e8] to-[#f0f4eb] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3 mb-4 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-[#2d4a22] flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#6b9937] to-[#4a7a25] rounded-xl flex items-center justify-center shadow-lg">
                  <Palette className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                Oak Creative
              </h1>
              <p className="text-[#5a7a4a] mt-1 text-sm hidden sm:block">Create stunning wedding proposals and presentations</p>
            </div>
            <Button
              onClick={() => setShowNewPresentationDialog(true)}
              className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] hover:from-[#5a8830] hover:to-[#3d6920] text-white shadow-md w-full sm:w-auto"
              data-testid="button-new-presentation"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Presentation
            </Button>
          </div>

          {presentations.length === 0 ? (
            <Card className="border-dashed border-2 border-[#6b9937]/30 bg-white/70 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-[#6b9937]/20 to-[#c9a961]/20 rounded-2xl flex items-center justify-center mb-4">
                  <Presentation className="h-10 w-10 text-[#6b9937]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2d4a22] mb-2">No presentations yet</h3>
                <p className="text-[#5a7a4a] text-center max-w-md mb-6">
                  Create your first presentation to start building beautiful wedding proposals
                </p>
                <Button
                  onClick={() => setShowNewPresentationDialog(true)}
                  className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] text-white shadow-md"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Presentation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {presentations.map((presentation) => (
                <Card 
                  key={presentation.id}
                  className="group hover:shadow-xl transition-all cursor-pointer bg-white overflow-hidden border border-[#6b9937]/20 relative"
                  onClick={() => setSelectedPresentation(presentation.id)}
                  data-testid={`card-presentation-${presentation.id}`}
                >
                  <div className="h-40 bg-gradient-to-br from-[#6b9937] via-[#5a8830] to-[#4a7a25] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNTQuNjI3IDM2LjE4TDM2LjE4IDU0LjYyNyIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] opacity-30" />
                    <Presentation className="h-16 w-16 text-white/90 drop-shadow-lg" />
                    <div className="absolute bottom-2 right-2 bg-[#c9a961] text-white text-xs px-2 py-1 rounded-full font-medium">
                      {presentation.eventType || "Wedding"}
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${presentation.title}"? This will remove all slides and images.`)) {
                          deletePresentationMutation.mutate(presentation.id);
                        }
                      }}
                      data-testid={`button-delete-presentation-${presentation.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg text-[#2d4a22] truncate">{presentation.title}</h3>
                    {presentation.clientName && (
                      <p className="text-sm text-[#5a7a4a]">For: {presentation.clientName}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <Badge className="text-xs bg-[#6b9937]/10 text-[#6b9937] border-[#6b9937]/30">
                        {presentation.status || "Draft"}
                      </Badge>
                      <p className="text-xs text-[#8a9a7a]">
                        {presentation.createdAt ? new Date(presentation.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* New Presentation Dialog */}
        <Dialog open={showNewPresentationDialog} onOpenChange={setShowNewPresentationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Presentation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newPresentation.title}
                  onChange={(e) => setNewPresentation({ ...newPresentation, title: e.target.value })}
                  placeholder="Wedding Proposal - Priya & Raj"
                  data-testid="input-presentation-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  value={newPresentation.clientName}
                  onChange={(e) => setNewPresentation({ ...newPresentation, clientName: e.target.value })}
                  placeholder="Priya & Raj"
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={newPresentation.theme}
                  onValueChange={(value) => setNewPresentation({ ...newPresentation, theme: value })}
                >
                  <SelectTrigger data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={newPresentation.eventType}
                  onValueChange={(value) => setNewPresentation({ ...newPresentation, eventType: value })}
                >
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewPresentationDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createPresentationMutation.mutate(newPresentation)}
                disabled={!newPresentation.title || createPresentationMutation.isPending}
                className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] text-white"
                data-testid="button-create-presentation"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Editor view
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#f5f7f2] to-[#eef2e8]">
      {/* Top toolbar */}
      <div className="h-auto min-h-14 bg-white border-b border-[#6b9937]/20 flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:px-4 gap-2 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPresentation(null);
              setSelectedSlide(null);
            }}
            data-testid="button-back"
            className="h-8 px-2 sm:px-3"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{presentationFull?.title || "Loading..."}</h2>
            <p className="text-xs text-gray-500 truncate hidden sm:block">{presentationFull?.clientName || ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Mobile sidebar toggles */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden h-8"
            onClick={() => setShowMobileSidebar(showMobileSidebar === 'slides' ? null : 'slides')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden h-8"
            onClick={() => setShowMobileSidebar(showMobileSidebar === 'assets' ? null : 'assets')}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiDialog(true)}
            data-testid="button-ai-generate"
            className="h-8"
          >
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">AI Generate</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPPT}
            data-testid="button-export-ppt"
            className="h-8"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export PPT</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete this presentation?")) {
                deletePresentationMutation.mutate(selectedPresentation);
              }
            }}
            data-testid="button-delete-presentation"
            className="h-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowMobileSidebar(null)}
          />
        )}

        {/* Left panel - Slide thumbnails */}
        <div className={`${showMobileSidebar === 'slides' ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden'} md:relative md:block md:w-64 bg-white border-r border-[#6b9937]/20 flex flex-col`}>
          <div className="p-3 border-b border-[#6b9937]/20 flex items-center justify-between bg-[#f5f7f2]">
            <span className="font-medium text-sm text-[#2d4a22]">Slides</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="bg-[#6b9937] hover:bg-[#5a8830] text-white h-7 w-7 p-0"
                onClick={() => setShowNewSlideDialog(true)}
                data-testid="button-add-slide"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden h-7 w-7 p-0"
                onClick={() => setShowMobileSidebar(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {presentationFull?.slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`relative group rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedSlide === slide.id
                      ? "ring-2 ring-[#6b9937] shadow-md"
                      : "hover:ring-2 hover:ring-[#6b9937]/50"
                  }`}
                  onClick={() => setSelectedSlide(slide.id)}
                  data-testid={`slide-thumbnail-${slide.id}`}
                >
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#6b9937]/10 to-[#c9a961]/10 flex items-center justify-center relative">
                    {slide.images && slide.images.length > 0 ? (
                      <img 
                        src={slide.images[0].imageUrl} 
                        alt={slide.title || ""} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="text-center bg-white/90 px-2 py-1 rounded">
                        <span className="text-xs font-bold text-[#6b9937] block">
                          {index + 1}
                        </span>
                        <span className="text-xs text-[#2d4a22] truncate block max-w-16">
                          {slide.category || slide.title || slide.slideType}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSlideMutation.mutate(slide.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {(!presentationFull?.slides || presentationFull.slides.length === 0) && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No slides yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 p-6 overflow-auto bg-[#e8ece3]">
          {currentSlide ? (
            <div className="max-w-4xl mx-auto">
              <Card className="aspect-[16/9] overflow-hidden shadow-2xl border-2 border-[#6b9937]/20">
                {/* Slide preview */}
                <div className="h-full flex flex-col">
                  {/* Slide header */}
                  <div className="bg-gradient-to-r from-[#6b9937] via-[#5a8830] to-[#4a7a25] p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#c9a961]/20 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                    <h3 className="text-2xl font-bold text-white relative z-10">
                      {currentSlide.title || currentSlide.category || "Untitled Slide"}
                    </h3>
                    {currentSlide.subtitle && (
                      <p className="text-white/80 relative z-10">{currentSlide.subtitle}</p>
                    )}
                    <div className="absolute bottom-2 right-4 text-white/50 text-xs font-medium">
                    </div>
                  </div>
                  
                  {/* Slide content */}
                  <div className="flex-1 bg-gradient-to-br from-white to-[#f5f7f2] p-6 overflow-auto">
                    {/* Text content from AI generation */}
                    {currentSlide.content && typeof currentSlide.content === 'object' && (currentSlide.content as any).text && (
                      <div className="mb-4 p-4 bg-[#6b9937]/5 rounded-lg border border-[#6b9937]/20">
                        <p className="text-[#2d4a22] leading-relaxed">
                          {(currentSlide.content as any).text}
                        </p>
                      </div>
                    )}
                    
                    {/* Images grid */}
                    {currentSlide.images && currentSlide.images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {currentSlide.images.map((img, index) => (
                          <div
                            key={img.id}
                            className="relative group aspect-square rounded-xl overflow-hidden bg-[#6b9937]/10 flex items-center justify-center shadow-md border border-[#6b9937]/20"
                          >
                            <img
                              src={img.imageUrl}
                              alt={img.optionLabel || `Option ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f4eb' width='200' height='200'/%3E%3Ctext fill='%236b9937' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='14'%3EImage%3C/text%3E%3C/svg%3E";
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#2d4a22]/80 to-transparent p-3">
                              <p className="text-white text-sm text-center font-medium">
                                {img.optionLabel || `Option ${index + 1}`}
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteImageMutation.mutate(img.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : !currentSlide.content ? (
                      <div className="h-full flex flex-col items-center justify-center text-[#6b9937]/50">
                        <div className="w-24 h-24 bg-[#6b9937]/10 rounded-full flex items-center justify-center mb-4">
                          <ImageIcon className="h-12 w-12 text-[#6b9937]/40" />
                        </div>
                        <p className="text-[#5a7a4a]">Add images from the asset library</p>
                        <p className="text-xs text-[#8a9a7a] mt-1">or use AI Generate to create content</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-[#6b9937]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LayoutGrid className="h-12 w-12 text-[#6b9937]/40" />
                </div>
                <p className="text-lg text-[#5a7a4a]">Select a slide or create a new one</p>
                <p className="text-sm text-[#8a9a7a] mt-1">Use AI Generate to auto-create slides</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Properties & Assets */}
        <div className={`${showMobileSidebar === 'assets' ? 'fixed inset-y-0 right-0 z-50 w-72' : 'hidden'} md:relative md:block md:w-72 bg-white border-l border-[#6b9937]/20 flex flex-col`}>
          {/* Mobile close button */}
          <div className="md:hidden p-2 border-b border-[#6b9937]/20 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowMobileSidebar(null)}
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
          <Tabs defaultValue="assets" className="flex-1 flex flex-col">
            <TabsList className="m-2 bg-[#6b9937]/10">
              <TabsTrigger value="assets" className="flex-1 data-[state=active]:bg-[#6b9937] data-[state=active]:text-white">Assets</TabsTrigger>
              <TabsTrigger value="properties" className="flex-1 data-[state=active]:bg-[#6b9937] data-[state=active]:text-white">Properties</TabsTrigger>
            </TabsList>
            
            <TabsContent value="assets" className="flex-1 overflow-auto p-3">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#5a7a4a]">
                    Click an asset to add it
                  </p>
                  <Button
                    size="sm"
                    className="bg-[#6b9937] hover:bg-[#5a8830] text-white"
                    onClick={() => setShowUploadDialog(true)}
                    data-testid="button-upload-asset"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </div>
                
                {SLIDE_CATEGORIES.map((category) => {
                  const categoryAssets = assets.filter(a => a.category === category);
                  if (categoryAssets.length === 0) return null;
                  
                  return (
                    <div key={category}>
                      <h4 className="font-medium text-sm text-[#2d4a22] mb-2">{category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className="aspect-square rounded-lg overflow-hidden bg-[#6b9937]/10 cursor-pointer hover:ring-2 hover:ring-[#6b9937] transition-all border border-[#6b9937]/20"
                            onClick={() => {
                              if (selectedSlide) {
                                addImageToSlideMutation.mutate({
                                  slideId: selectedSlide,
                                  imageUrl: asset.imageUrl,
                                  optionLabel: asset.name
                                });
                              } else {
                                toast({ title: "Select a slide first", variant: "destructive" });
                              }
                            }}
                          >
                            <img
                              src={asset.thumbnailUrl || asset.imageUrl}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {assets.length === 0 && (
                  <div className="text-center py-8 text-[#8a9a7a]">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 text-[#6b9937]/40" />
                    <p className="text-sm">No assets uploaded yet</p>
                    <p className="text-xs mt-1">Upload images to the asset library</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="properties" className="flex-1 overflow-auto p-3">
              {currentSlide ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#2d4a22]">Slide Type</Label>
                    <Input value={currentSlide.slideType} disabled className="bg-[#f5f7f2] border-[#6b9937]/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#2d4a22]">Category</Label>
                    <Input value={currentSlide.category || ""} disabled className="bg-[#f5f7f2] border-[#6b9937]/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#2d4a22]">Title</Label>
                    <Input value={currentSlide.title || ""} disabled className="bg-[#f5f7f2] border-[#6b9937]/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#2d4a22]">Layout</Label>
                    <Input value={currentSlide.layout || "options-grid"} disabled className="bg-[#f5f7f2] border-[#6b9937]/20" />
                  </div>
                  <Separator className="bg-[#6b9937]/20" />
                  <div>
                    <Label className="text-sm text-[#2d4a22]">Images ({currentSlide.images?.length || 0})</Label>
                    <p className="text-xs text-[#5a7a4a] mt-1">
                      Add images from the Assets tab
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[#8a9a7a]">
                  <Type className="h-10 w-10 mx-auto mb-2 text-[#6b9937]/40" />
                  <p className="text-sm">Select a slide to view properties</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* New Slide Dialog */}
      <Dialog open={showNewSlideDialog} onOpenChange={setShowNewSlideDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Slide</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Slide Type</Label>
              <Select
                value={newSlide.slideType}
                onValueChange={(value) => setNewSlide({ ...newSlide, slideType: value })}
              >
                <SelectTrigger data-testid="select-slide-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newSlide.category}
                onValueChange={(value) => setNewSlide({ ...newSlide, category: value, title: value })}
              >
                <SelectTrigger data-testid="select-slide-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={newSlide.title}
                onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
                placeholder="Custom title for the slide"
                data-testid="input-slide-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSlideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSlideMutation.mutate(newSlide)}
              disabled={createSlideMutation.isPending}
              className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] text-white"
              data-testid="button-create-slide"
            >
              Add Slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#c9a961]" />
              Generate with Oaksy AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#5a7a4a]">
              Describe the presentation you want to create and Oaksy will generate slides with AI images for you.
            </p>
            <div className="space-y-2">
              <Label>Your prompt</Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Create a proposal for a Kerala Hindu wedding with 10 slides..."
                className="h-20"
                data-testid="input-ai-prompt"
              />
            </div>
            <div className="bg-[#6b9937]/10 rounded-lg p-3 border border-[#6b9937]/20">
              <p className="text-xs text-[#2d4a22]">
                <strong>Examples:</strong>
                <br />• "Create a Hindu wedding proposal with mandap, entrance, and reception"
                <br />• "Generate a modern minimalist wedding presentation"
                <br />• "Build slides for a beach wedding in Kerala"
              </p>
            </div>
            <div className="bg-[#c9a961]/10 rounded-lg p-3 border border-[#c9a961]/30">
              <p className="text-xs text-[#8a6a31]">
                <strong>Note:</strong> AI will generate up to 5 images using DALL-E. This may take 30-60 seconds.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAiGenerate}
              disabled={!aiPrompt.trim() || isGenerating}
              className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] text-white"
              data-testid="button-generate-ai"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Slides & Images"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Asset Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#6b9937]" />
              Upload Asset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={uploadCategory}
                onValueChange={setUploadCategory}
              >
                <SelectTrigger data-testid="select-upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Asset name"
                data-testid="input-upload-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Image File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#6b9937]/10 file:text-[#6b9937] hover:file:bg-[#6b9937]/20"
                data-testid="input-upload-file"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const file = fileInputRef.current?.files?.[0];
                if (file) {
                  handleUploadAsset(file);
                }
              }}
              disabled={isUploading}
              className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] text-white"
              data-testid="button-confirm-upload"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
