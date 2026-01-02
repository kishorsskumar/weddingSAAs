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

  const handleExportPDF = async () => {
    if (!presentationFull) return;
    
    toast({ title: "Generating PDF...", description: "This may take a moment" });
    
    try {
      const jspdf = await import("jspdf");
      const pdf = new jspdf.jsPDF("landscape", "pt", "a4");
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Cover slide
      pdf.setFillColor(139, 90, 43); // Oak brown
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(48);
      pdf.text(presentationFull.title, pageWidth / 2, pageHeight / 2 - 50, { align: "center" });
      pdf.setFontSize(24);
      if (presentationFull.clientName) {
        pdf.text(`For: ${presentationFull.clientName}`, pageWidth / 2, pageHeight / 2 + 20, { align: "center" });
      }
      pdf.setFontSize(14);
      pdf.text("Oakstreet Events", pageWidth / 2, pageHeight - 50, { align: "center" });

      // Category slides
      for (const slide of presentationFull.slides) {
        pdf.addPage("a4", "landscape");
        
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        
        // Header
        pdf.setFillColor(139, 90, 43);
        pdf.rect(0, 0, pageWidth, 80, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(32);
        pdf.text(slide.title || slide.category || "Slide", pageWidth / 2, 50, { align: "center" });
        
        // Content area
        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(16);
        
        if (slide.images && slide.images.length > 0) {
          const cols = Math.min(slide.images.length, 3);
          const rows = Math.ceil(slide.images.length / cols);
          const imgWidth = (pageWidth - 100) / cols - 20;
          const imgHeight = (pageHeight - 180) / rows - 40;
          
          slide.images.forEach((img, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = 50 + col * (imgWidth + 20);
            const y = 100 + row * (imgHeight + 40);
            
            // Placeholder rectangle for image
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(x, y, imgWidth, imgHeight);
            pdf.setFontSize(12);
            pdf.text(img.optionLabel || `Option ${index + 1}`, x + imgWidth / 2, y + imgHeight + 20, { align: "center" });
          });
        } else {
          pdf.text("Add images to this slide", pageWidth / 2, pageHeight / 2, { align: "center" });
        }
      }
      
      // Contact slide
      pdf.addPage("a4", "landscape");
      pdf.setFillColor(139, 90, 43);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(36);
      pdf.text("Thank You", pageWidth / 2, pageHeight / 2 - 50, { align: "center" });
      pdf.setFontSize(20);
      pdf.text("Oakstreet Events", pageWidth / 2, pageHeight / 2 + 20, { align: "center" });
      pdf.setFontSize(14);
      pdf.text("Contact us for your dream event", pageWidth / 2, pageHeight / 2 + 60, { align: "center" });
      
      pdf.save(`${presentationFull.title || "presentation"}.pdf`);
      toast({ title: "PDF exported successfully!" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "Export failed", variant: "destructive" });
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
      <div className="min-h-screen bg-gradient-to-br from-[#f5f7f2] via-[#eef2e8] to-[#f0f4eb] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[#2d4a22] flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#6b9937] to-[#4a7a25] rounded-xl flex items-center justify-center shadow-lg">
                  <Palette className="h-6 w-6 text-white" />
                </div>
                Oak Creative
              </h1>
              <p className="text-[#5a7a4a] mt-1">Create stunning wedding proposals and presentations</p>
            </div>
            <Button
              onClick={() => setShowNewPresentationDialog(true)}
              className="bg-gradient-to-r from-[#6b9937] to-[#4a7a25] hover:from-[#5a8830] hover:to-[#3d6920] text-white shadow-md"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presentations.map((presentation) => (
                <Card 
                  key={presentation.id}
                  className="group hover:shadow-xl transition-all cursor-pointer bg-white overflow-hidden border border-[#6b9937]/20"
                  onClick={() => setSelectedPresentation(presentation.id)}
                  data-testid={`card-presentation-${presentation.id}`}
                >
                  <div className="h-40 bg-gradient-to-br from-[#6b9937] via-[#5a8830] to-[#4a7a25] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNTQuNjI3IDM2LjE4TDM2LjE4IDU0LjYyNyIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] opacity-30" />
                    <Presentation className="h-16 w-16 text-white/90 drop-shadow-lg" />
                    <div className="absolute bottom-2 right-2 bg-[#c9a961] text-white text-xs px-2 py-1 rounded-full font-medium">
                      {presentation.eventType || "Wedding"}
                    </div>
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
      <div className="h-14 bg-white border-b border-[#6b9937]/20 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPresentation(null);
              setSelectedSlide(null);
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <h2 className="font-semibold text-gray-900">{presentationFull?.title || "Loading..."}</h2>
            <p className="text-xs text-gray-500">{presentationFull?.clientName || ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiDialog(true)}
            data-testid="button-ai-generate"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Generate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
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
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Slide thumbnails */}
        <div className="w-64 bg-white border-r border-[#6b9937]/20 flex flex-col">
          <div className="p-3 border-b border-[#6b9937]/20 flex items-center justify-between bg-[#f5f7f2]">
            <span className="font-medium text-sm text-[#2d4a22]">Slides</span>
            <Button
              size="sm"
              className="bg-[#6b9937] hover:bg-[#5a8830] text-white h-7 w-7 p-0"
              onClick={() => setShowNewSlideDialog(true)}
              data-testid="button-add-slide"
            >
              <Plus className="h-4 w-4" />
            </Button>
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
                      Oakstreet Events
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
        <div className="w-72 bg-white border-l border-[#6b9937]/20 flex flex-col">
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
