import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, ArrowLeft, Image, MoreHorizontal, Trash2, Edit2, 
  Upload, FolderPlus, Calendar, MapPin, Eye, Grid3X3, List, Loader2, X, Link,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// Convert Google Drive URLs to direct image URLs using lh3.googleusercontent.com CDN
function convertToDirectImageUrl(url: string): string {
  if (!url) return url;
  
  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing or ?usp=drive_link
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    fileId = driveFileMatch[1];
  }
  
  // Format: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    fileId = driveOpenMatch[1];
  }
  
  // Format: https://drive.google.com/uc?id=FILE_ID or ?export=view&id=FILE_ID
  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveUcMatch) {
    fileId = driveUcMatch[1];
  }
  
  // Format: https://drive.google.com/thumbnail?id=FILE_ID
  const driveThumbnailMatch = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumbnailMatch) {
    fileId = driveThumbnailMatch[1];
  }
  
  // If we found a file ID, use Google's CDN which works better with CORS
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }
  
  return url;
}

interface PortfolioAlbum {
  id: string;
  title: string;
  tagline: string | null;
  venue: string | null;
  coverImageUrl: string;
  category: string;
  eventDate: string | null;
  featured: boolean;
}

interface PortfolioSet {
  id: string;
  albumId: string;
  name: string;
  sortOrder: number;
}

interface PortfolioPhoto {
  id: string;
  albumId: string | null;
  setId: string | null;
  imageUrl: string;
  caption: string | null;
}

type View = 'collections' | 'collection-detail';

export default function PortfolioAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('collections');
  const [selectedAlbum, setSelectedAlbum] = useState<PortfolioAlbum | null>(null);
  const [selectedSet, setSelectedSet] = useState<PortfolioSet | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showAddSet, setShowAddSet] = useState(false);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<PortfolioAlbum | null>(null);

  const [newCollection, setNewCollection] = useState({ title: '', eventDate: '', venue: '', coverImageUrl: '' });
  const [newSetName, setNewSetName] = useState('');
  const [photoUrls, setPhotoUrls] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [coverUploadMode, setCoverUploadMode] = useState<'file' | 'url'>('url');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [coverFileError, setCoverFileError] = useState<string | null>(null);
  const [editCoverUploadMode, setEditCoverUploadMode] = useState<'file' | 'url'>('url');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [isUploadingEditCover, setIsUploadingEditCover] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editCoverFileError, setEditCoverFileError] = useState<string | null>(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<Array<{ id: string; imageUrl: string; caption?: string | null }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const validateCoverFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Only JPG and PNG files are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`;
    }
    return null;
  };

  // Lightbox navigation
  const openLightbox = useCallback((photos: Array<{ id: string; imageUrl: string; caption?: string | null }>, index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % lightboxPhotos.length);
  }, [lightboxPhotos.length]);

  const prevPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length);
  }, [lightboxPhotos.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, nextPhoto, prevPhoto]);

  const { data: albums = [], isLoading: loadingAlbums } = useQuery<PortfolioAlbum[]>({
    queryKey: ['/api/admin/portfolio/albums'],
  });

  const { data: sets = [] } = useQuery<PortfolioSet[]>({
    queryKey: [`/api/admin/portfolio/albums/${selectedAlbum?.id}/sets`],
    enabled: !!selectedAlbum,
  });

  const { data: photos = [] } = useQuery<PortfolioPhoto[]>({
    queryKey: [`/api/admin/portfolio/sets/${selectedSet?.id}/photos`],
    enabled: !!selectedSet,
  });

  const createAlbumMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/portfolio/albums', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portfolio/albums'] });
      setShowCreateCollection(false);
      setNewCollection({ title: '', eventDate: '', venue: '', coverImageUrl: '' });
      toast({ title: 'Collection created successfully' });
    },
  });

  const updateAlbumMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => 
      apiRequest('PUT', `/api/admin/portfolio/albums/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portfolio/albums'] });
      setEditingAlbum(null);
      toast({ title: 'Collection updated successfully' });
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/portfolio/albums/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portfolio/albums'] });
      setSelectedAlbum(null);
      setView('collections');
      toast({ title: 'Collection deleted' });
    },
  });

  const createSetMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/portfolio/sets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/portfolio/albums/${selectedAlbum?.id}/sets`] });
      setShowAddSet(false);
      setNewSetName('');
      toast({ title: 'Set added successfully' });
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/portfolio/sets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/portfolio/albums/${selectedAlbum?.id}/sets`] });
      if (selectedSet?.id === selectedSet?.id) setSelectedSet(null);
      toast({ title: 'Set deleted' });
    },
  });

  const addPhotosMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/admin/portfolio/photos/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/portfolio/sets/${selectedSet?.id}/photos`] });
      setShowAddPhotos(false);
      setPhotoUrls('');
      toast({ title: 'Photos added successfully' });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/portfolio/photos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/portfolio/sets/${selectedSet?.id}/photos`] });
      toast({ title: 'Photo deleted' });
    },
  });

  const handleCreateCollection = () => {
    if (!newCollection.title) {
      toast({ title: 'Please enter a collection name', variant: 'destructive' });
      return;
    }
    createAlbumMutation.mutate({
      title: newCollection.title,
      eventDate: newCollection.eventDate || null,
      venue: newCollection.venue || null,
      coverImageUrl: newCollection.coverImageUrl || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=600&fit=crop',
      category: 'Wedding',
      featured: true,
    });
  };

  const handleAddSet = () => {
    if (!newSetName.trim() || !selectedAlbum) return;
    createSetMutation.mutate({
      albumId: selectedAlbum.id,
      name: newSetName.trim(),
      sortOrder: sets.length,
    });
  };

  const handleAddPhotos = () => {
    if (!photoUrls.trim() || !selectedSet || !selectedAlbum) return;
    const urls = photoUrls.split('\n').map(u => u.trim()).filter(Boolean);
    const photosData = urls.map((url, i) => ({
      albumId: selectedAlbum.id,
      setId: selectedSet.id,
      imageUrl: url,
      sortOrder: photos.length + i,
    }));
    addPhotosMutation.mutate({ photos: photosData });
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0 || !selectedSet || !selectedAlbum) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('albumId', selectedAlbum.id);
      formData.append('setId', selectedSet.id);
      selectedFiles.forEach(file => formData.append('photos', file));
      
      const response = await fetch('/api/admin/portfolio/photos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [`/api/admin/portfolio/sets/${selectedSet.id}/photos`] });
      setShowAddPhotos(false);
      setSelectedFiles([]);
      toast({ title: `${result.count} photos uploaded successfully` });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const uploadCoverImage = async (
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append('cover', file);

      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && result.success) {
            toast({ title: 'Cover image uploaded successfully' });
            resolve(result.imageUrl);
          } else {
            const errorMsg = result.error || 'Upload failed';
            toast({ title: 'Upload failed', description: errorMsg, variant: 'destructive' });
            resolve(null);
          }
        } catch {
          toast({ title: 'Upload failed', description: 'Invalid server response', variant: 'destructive' });
          resolve(null);
        }
      });

      // Handle network errors
      xhr.addEventListener('error', () => {
        toast({ title: 'Upload failed', description: 'Network error. Please check your connection.', variant: 'destructive' });
        resolve(null);
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        toast({ title: 'Upload failed', description: 'Request timed out. Please try again.', variant: 'destructive' });
        resolve(null);
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        toast({ title: 'Upload cancelled', variant: 'destructive' });
        resolve(null);
      });

      xhr.open('POST', '/api/admin/portfolio/cover-upload');
      xhr.withCredentials = true;
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(formData);
    });
  };

  const handleCreateCollectionWithUpload = async () => {
    if (!newCollection.title.trim()) {
      toast({ title: 'Please enter a collection name', variant: 'destructive' });
      return;
    }
    
    let coverImageUrl = newCollection.coverImageUrl;
    
    if (coverUploadMode === 'file' && coverFile) {
      // Validate file before upload
      const validationError = validateCoverFile(coverFile);
      if (validationError) {
        setCoverFileError(validationError);
        toast({ title: 'Invalid file', description: validationError, variant: 'destructive' });
        return;
      }
      
      setIsUploadingCover(true);
      setUploadProgress(0);
      setCoverFileError(null);
      
      try {
        const uploadedUrl = await uploadCoverImage(coverFile, (progress) => {
          setUploadProgress(progress);
        });
        
        if (uploadedUrl) {
          coverImageUrl = uploadedUrl;
        } else {
          // Upload failed - error toast already shown, reset state and exit
          return;
        }
      } finally {
        // Always reset loading state
        setIsUploadingCover(false);
        setUploadProgress(0);
      }
    }
    
    createAlbumMutation.mutate({
      title: newCollection.title,
      eventDate: newCollection.eventDate || null,
      venue: newCollection.venue || null,
      coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=600&fit=crop',
      category: 'wedding',
      featured: false,
    });
    setCoverFile(null);
    setCoverUploadMode('url');
    setCoverFileError(null);
  };

  const handleUpdateAlbumWithUpload = async () => {
    if (!editingAlbum) return;
    
    let coverImageUrl = editingAlbum.coverImageUrl;
    
    if (editCoverUploadMode === 'file' && editCoverFile) {
      // Validate file before upload
      const validationError = validateCoverFile(editCoverFile);
      if (validationError) {
        setEditCoverFileError(validationError);
        toast({ title: 'Invalid file', description: validationError, variant: 'destructive' });
        return;
      }
      
      setIsUploadingEditCover(true);
      setEditUploadProgress(0);
      setEditCoverFileError(null);
      
      try {
        const uploadedUrl = await uploadCoverImage(editCoverFile, (progress) => {
          setEditUploadProgress(progress);
        });
        
        if (uploadedUrl) {
          coverImageUrl = uploadedUrl;
        } else {
          // Upload failed - error toast already shown, reset state and exit
          return;
        }
      } finally {
        // Always reset loading state
        setIsUploadingEditCover(false);
        setEditUploadProgress(0);
      }
    }
    
    updateAlbumMutation.mutate({ 
      id: editingAlbum.id, 
      data: { ...editingAlbum, coverImageUrl } 
    });
    setEditCoverFile(null);
    setEditCoverUploadMode('url');
    setEditCoverFileError(null);
  };

  const openCollection = (album: PortfolioAlbum) => {
    setSelectedAlbum(album);
    setSelectedSet(null);
    setView('collection-detail');
  };

  if (view === 'collection-detail' && selectedAlbum) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="w-64 bg-gray-50 border-r flex flex-col">
          <div className="p-4 border-b bg-white">
            <button 
              onClick={() => { setView('collections'); setSelectedAlbum(null); setSelectedSet(null); }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <h2 className="font-semibold text-lg truncate">{selectedAlbum.title}</h2>
            <p className="text-xs text-gray-500">{selectedAlbum.eventDate || 'No date set'}</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase">Sets</span>
              <button 
                onClick={() => setShowAddSet(true)}
                className="text-[#4b7c29] hover:text-[#3d6621] flex items-center gap-1 text-xs"
              >
                <Plus className="w-3 h-3" /> Add Set
              </button>
            </div>

            <div className="space-y-1 p-2">
              {sets.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No sets yet</p>
                  <p className="text-xs">Add sets like Highlights, Sangeet, Haldi...</p>
                </div>
              ) : (
                sets.map(set => (
                  <div
                    key={set.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer group",
                      selectedSet?.id === set.id ? "bg-[#4b7c29]/10 text-[#4b7c29]" : "hover:bg-gray-100"
                    )}
                    onClick={() => setSelectedSet(set)}
                  >
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      <span className="text-sm font-medium">{set.name}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem 
                          className="text-red-600" 
                          onClick={() => deleteSetMutation.mutate(set.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Set
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 border-t bg-white">
            <img 
              src={convertToDirectImageUrl(selectedAlbum.coverImageUrl)} 
              alt={selectedAlbum.title}
              className="w-full aspect-[4/3] object-cover rounded-lg mb-2"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <MoreHorizontal className="w-4 h-4 mr-2" /> Collection Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEditingAlbum(selectedAlbum)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Collection
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => {
                    if (confirm('Delete this entire collection?')) {
                      deleteAlbumMutation.mutate(selectedAlbum.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedSet ? (
            <>
              <div className="p-4 border-b flex items-center justify-between bg-white">
                <h3 className="font-semibold text-lg">{selectedSet.name}</h3>
                <Button 
                  onClick={() => setShowAddPhotos(true)}
                  className="bg-[#4b7c29] hover:bg-[#3d6621]"
                >
                  <Upload className="w-4 h-4 mr-2" /> Add Photos
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium text-gray-600">Drag photos and videos here to upload</p>
                      <p className="text-sm mt-2">or <button onClick={() => setShowAddPhotos(true)} className="text-[#4b7c29] hover:underline">Browse files</button></p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img 
                          src={convertToDirectImageUrl(photo.imageUrl)} 
                          alt={photo.caption || ''} 
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => openLightbox(photos, index)}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.dataset.retried) {
                              target.dataset.retried = 'true';
                              target.src = photo.imageUrl;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none">
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhotoMutation.mutate(photo.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 z-10"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a set to view photos</p>
                <p className="text-sm mt-2">Or add a new set from the sidebar</p>
              </div>
            </div>
          )}
        </div>

        <Dialog open={showAddSet} onOpenChange={setShowAddSet}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Set</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Set Name</Label>
                <Input 
                  placeholder="e.g., Highlights, Sangeet, Haldi, Wedding..."
                  value={newSetName}
                  onChange={e => setNewSetName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSet(false)}>Cancel</Button>
              <Button 
                onClick={handleAddSet}
                disabled={createSetMutation.isPending}
                className="bg-[#4b7c29] hover:bg-[#3d6621]"
              >
                Add Set
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddPhotos} onOpenChange={(open) => {
          setShowAddPhotos(open);
          if (!open) {
            setSelectedFiles([]);
            setPhotoUrls('');
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Photos to {selectedSet?.name}</DialogTitle>
            </DialogHeader>
            
            <div className="flex gap-2 mb-4">
              <Button 
                variant={uploadMode === 'file' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setUploadMode('file')}
                className={uploadMode === 'file' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                data-testid="button-upload-mode-file"
              >
                <Upload className="w-4 h-4 mr-2" /> Upload Files
              </Button>
              <Button 
                variant={uploadMode === 'url' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setUploadMode('url')}
                className={uploadMode === 'url' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                data-testid="button-upload-mode-url"
              >
                <Link className="w-4 h-4 mr-2" /> Paste URLs
              </Button>
            </div>

            {uploadMode === 'file' ? (
              <div className="space-y-4">
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                    isDragOver ? "border-[#4b7c29] bg-green-50" : "border-gray-300 hover:border-[#4b7c29]"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('photo-file-input')?.click()}
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Drag photos here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, WebP (max 10MB each)</p>
                  <input 
                    id="photo-file-input"
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileSelect}
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>{selectedFiles.length} file(s) selected</Label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                          <span className="truncate flex-1">{file.name}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="ml-2 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Photo URLs (one per line)</Label>
                  <textarea 
                    className="w-full min-h-[200px] p-3 border rounded-md text-sm"
                    placeholder="https://example.com/photo1.jpg&#10;https://drive.google.com/file/d/...&#10;https://example.com/photo3.jpg"
                    value={photoUrls}
                    onChange={e => setPhotoUrls(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter image URLs or Google Drive links, one per line.</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPhotos(false)}>Cancel</Button>
              {uploadMode === 'file' ? (
                <Button 
                  onClick={handleFileUpload}
                  disabled={isUploading || selectedFiles.length === 0}
                  className="bg-[#4b7c29] hover:bg-[#3d6621]"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}`
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleAddPhotos}
                  disabled={addPhotosMutation.isPending || !photoUrls.trim()}
                  className="bg-[#4b7c29] hover:bg-[#3d6621]"
                >
                  {addPhotosMutation.isPending ? 'Adding...' : 'Add Photos'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingAlbum} onOpenChange={() => setEditingAlbum(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Collection</DialogTitle>
            </DialogHeader>
            {editingAlbum && (
              <div className="space-y-4">
                <div>
                  <Label>Collection Name</Label>
                  <Input 
                    value={editingAlbum.title}
                    onChange={e => setEditingAlbum({ ...editingAlbum, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tagline</Label>
                  <Input 
                    value={editingAlbum.tagline || ''}
                    onChange={e => setEditingAlbum({ ...editingAlbum, tagline: e.target.value })}
                    placeholder="A beautiful love story..."
                  />
                </div>
                <div>
                  <Label>Venue</Label>
                  <Input 
                    value={editingAlbum.venue || ''}
                    onChange={e => setEditingAlbum({ ...editingAlbum, venue: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Event Date</Label>
                  <Input 
                    type="date"
                    value={editingAlbum.eventDate || ''}
                    onChange={e => setEditingAlbum({ ...editingAlbum, eventDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cover Image</Label>
                  <div className="flex gap-2 mb-2">
                    <Button 
                      variant={editCoverUploadMode === 'file' ? 'default' : 'outline'} 
                      size="sm"
                      type="button"
                      onClick={() => setEditCoverUploadMode('file')}
                      className={editCoverUploadMode === 'file' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                    >
                      <Upload className="w-4 h-4 mr-1" /> Upload New
                    </Button>
                    <Button 
                      variant={editCoverUploadMode === 'url' ? 'default' : 'outline'} 
                      size="sm"
                      type="button"
                      onClick={() => setEditCoverUploadMode('url')}
                      className={editCoverUploadMode === 'url' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                    >
                      <Link className="w-4 h-4 mr-1" /> URL/Drive Link
                    </Button>
                  </div>
                  {editCoverUploadMode === 'file' ? (
                    <div>
                      <label className={`flex items-center gap-2 w-full text-sm border rounded p-3 cursor-pointer hover:bg-gray-50 transition-colors border-dashed border-2 ${editCoverFileError ? 'border-red-500' : 'border-[#4b7c29]'}`}>
                        <Upload className={`w-4 h-4 ${editCoverFileError ? 'text-red-500' : 'text-[#4b7c29]'}`} />
                        <span className="text-gray-600">
                          {editCoverFile ? editCoverFile.name : 'Click here to select image file...'}
                        </span>
                        <input 
                          type="file" 
                          accept=".jpg,.jpeg,.png"
                          className="hidden"
                          disabled={isUploadingEditCover}
                          onChange={e => {
                            const file = e.target.files?.[0] || null;
                            setEditCoverFile(file);
                            if (file) {
                              const error = validateCoverFile(file);
                              setEditCoverFileError(error);
                            } else {
                              setEditCoverFileError(null);
                            }
                          }}
                        />
                      </label>
                      {editCoverFile && !editCoverFileError && (
                        <p className="text-xs text-green-600 mt-1 font-medium">✓ Selected: {editCoverFile.name} ({(editCoverFile.size / 1024 / 1024).toFixed(1)}MB)</p>
                      )}
                      {editCoverFileError && (
                        <p className="text-xs text-red-500 mt-1 font-medium">✗ {editCoverFileError}</p>
                      )}
                      {isUploadingEditCover && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-sm text-[#4b7c29]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading... {editUploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-[#4b7c29] h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${editUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Max 5MB. Allowed: JPG, PNG only</p>
                    </div>
                  ) : (
                    <Input 
                      placeholder="https://drive.google.com/file/d/... or image URL"
                      value={editingAlbum.coverImageUrl}
                      onChange={e => setEditingAlbum({ ...editingAlbum, coverImageUrl: e.target.value })}
                    />
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAlbum(null)} disabled={isUploadingEditCover}>Cancel</Button>
              <Button 
                onClick={handleUpdateAlbumWithUpload}
                disabled={updateAlbumMutation.isPending || isUploadingEditCover || !!editCoverFileError}
                className="bg-[#4b7c29] hover:bg-[#3d6621]"
              >
                {isUploadingEditCover ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading {editUploadProgress}%</>
                ) : updateAlbumMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lightbox for fullscreen image viewing - Collection Detail View */}
        {lightboxOpen && lightboxPhotos.length > 0 && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-50"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Image counter */}
            <div className="absolute top-4 left-4 text-white text-lg font-medium">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>

            {/* Previous button */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
            )}

            {/* Main image */}
            <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={convertToDirectImageUrl(lightboxPhotos[lightboxIndex]?.imageUrl || '')}
                alt={lightboxPhotos[lightboxIndex]?.caption || ''}
                className="max-w-full max-h-[90vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.retried) {
                    target.dataset.retried = 'true';
                    target.src = lightboxPhotos[lightboxIndex]?.imageUrl || '';
                  }
                }}
              />
            </div>

            {/* Next button */}
            {lightboxPhotos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            )}

            {/* Caption */}
            {lightboxPhotos[lightboxIndex]?.caption && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center bg-black/50 px-4 py-2 rounded-lg">
                {lightboxPhotos[lightboxIndex].caption}
              </div>
            )}

            {/* Keyboard hint */}
            <div className="absolute bottom-4 right-4 text-white/50 text-sm">
              Use ← → arrows to navigate, ESC to close
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Manager</h1>
            <p className="text-gray-600">Manage your wedding and event collections</p>
          </div>
          <Button 
            onClick={() => setShowCreateCollection(true)}
            className="bg-[#4b7c29] hover:bg-[#3d6621]"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Collection
          </Button>
        </div>

        {loadingAlbums ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-gray-200 rounded-xl"></div>
                <div className="mt-3 h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16">
            <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No collections yet</h3>
            <p className="text-gray-500 mb-4">Create your first collection to get started</p>
            <Button 
              onClick={() => setShowCreateCollection(true)}
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Collection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map(album => (
              <div 
                key={album.id} 
                className="group cursor-pointer bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                onClick={() => openCollection(album)}
              >
                <div className="relative aspect-[4/3]">
                  <img 
                    src={convertToDirectImageUrl(album.coverImageUrl)} 
                    alt={album.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-lg">{album.title}</h3>
                    {album.venue && (
                      <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {album.venue}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="p-2 bg-white/90 rounded-full hover:bg-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditingAlbum(album); }}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); window.open(`/portfolio/${album.id}`, '_blank'); }}>
                          <Eye className="w-4 h-4 mr-2" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={e => { 
                            e.stopPropagation(); 
                            if (confirm('Delete this collection?')) deleteAlbumMutation.mutate(album.id); 
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {album.eventDate || 'No date'}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{album.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateCollection} onOpenChange={setShowCreateCollection}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Collection Name</Label>
              <Input 
                placeholder="e.g., Jessie & Ryan"
                value={newCollection.title}
                onChange={e => setNewCollection({ ...newCollection, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input 
                type="date"
                value={newCollection.eventDate}
                onChange={e => setNewCollection({ ...newCollection, eventDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Venue</Label>
              <Input 
                placeholder="e.g., Grand Hyatt, Kochi"
                value={newCollection.venue}
                onChange={e => setNewCollection({ ...newCollection, venue: e.target.value })}
              />
            </div>
            <div>
              <Label>Cover Image (optional)</Label>
              <div className="flex gap-2 mb-2">
                <Button 
                  variant={coverUploadMode === 'file' ? 'default' : 'outline'} 
                  size="sm"
                  type="button"
                  onClick={() => setCoverUploadMode('file')}
                  className={coverUploadMode === 'file' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                  data-testid="button-cover-mode-file"
                >
                  <Upload className="w-4 h-4 mr-1" /> Upload
                </Button>
                <Button 
                  variant={coverUploadMode === 'url' ? 'default' : 'outline'} 
                  size="sm"
                  type="button"
                  onClick={() => setCoverUploadMode('url')}
                  className={coverUploadMode === 'url' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                  data-testid="button-cover-mode-url"
                >
                  <Link className="w-4 h-4 mr-1" /> URL/Drive Link
                </Button>
              </div>
              {coverUploadMode === 'file' ? (
                <div>
                  <label className={`flex items-center gap-2 w-full text-sm border rounded p-3 cursor-pointer hover:bg-gray-50 transition-colors border-dashed border-2 ${coverFileError ? 'border-red-500' : 'border-[#4b7c29]'}`}>
                    <Upload className={`w-4 h-4 ${coverFileError ? 'text-red-500' : 'text-[#4b7c29]'}`} />
                    <span className="text-gray-600">
                      {coverFile ? coverFile.name : 'Click here to select image file...'}
                    </span>
                    <input 
                      type="file" 
                      accept=".jpg,.jpeg,.png"
                      className="hidden"
                      disabled={isUploadingCover}
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setCoverFile(file);
                        if (file) {
                          const error = validateCoverFile(file);
                          setCoverFileError(error);
                        } else {
                          setCoverFileError(null);
                        }
                      }}
                      data-testid="input-cover-file"
                    />
                  </label>
                  {coverFile && !coverFileError && (
                    <p className="text-xs text-green-600 mt-1 font-medium">✓ Selected: {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(1)}MB)</p>
                  )}
                  {coverFileError && (
                    <p className="text-xs text-red-500 mt-1 font-medium">✗ {coverFileError}</p>
                  )}
                  {isUploadingCover && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-sm text-[#4b7c29]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading... {uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-[#4b7c29] h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Max 5MB. Allowed: JPG, PNG only</p>
                </div>
              ) : (
                <Input 
                  placeholder="https://drive.google.com/file/d/... or image URL"
                  value={newCollection.coverImageUrl}
                  onChange={e => setNewCollection({ ...newCollection, coverImageUrl: e.target.value })}
                  data-testid="input-cover-url"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCollection(false)} disabled={isUploadingCover}>Cancel</Button>
            <Button 
              onClick={handleCreateCollectionWithUpload}
              disabled={createAlbumMutation.isPending || isUploadingCover || !!coverFileError}
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
            >
              {isUploadingCover ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading {uploadProgress}%</>
              ) : createAlbumMutation.isPending ? 'Creating...' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAlbum && view === 'collections'} onOpenChange={() => setEditingAlbum(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          {editingAlbum && (
            <div className="space-y-4">
              <div>
                <Label>Collection Name</Label>
                <Input 
                  value={editingAlbum.title}
                  onChange={e => setEditingAlbum({ ...editingAlbum, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Tagline</Label>
                <Input 
                  value={editingAlbum.tagline || ''}
                  onChange={e => setEditingAlbum({ ...editingAlbum, tagline: e.target.value })}
                  placeholder="A beautiful love story..."
                />
              </div>
              <div>
                <Label>Venue</Label>
                <Input 
                  value={editingAlbum.venue || ''}
                  onChange={e => setEditingAlbum({ ...editingAlbum, venue: e.target.value })}
                />
              </div>
              <div>
                <Label>Cover Image</Label>
                <div className="flex gap-2 mb-2">
                  <Button 
                    variant={editCoverUploadMode === 'file' ? 'default' : 'outline'} 
                    size="sm"
                    type="button"
                    onClick={() => setEditCoverUploadMode('file')}
                    className={editCoverUploadMode === 'file' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                    data-testid="button-edit-cover-mode-file"
                  >
                    <Upload className="w-4 h-4 mr-1" /> Upload New
                  </Button>
                  <Button 
                    variant={editCoverUploadMode === 'url' ? 'default' : 'outline'} 
                    size="sm"
                    type="button"
                    onClick={() => setEditCoverUploadMode('url')}
                    className={editCoverUploadMode === 'url' ? 'bg-[#4b7c29] hover:bg-[#3d6621]' : ''}
                    data-testid="button-edit-cover-mode-url"
                  >
                    <Link className="w-4 h-4 mr-1" /> URL/Drive Link
                  </Button>
                </div>
                {editCoverUploadMode === 'file' ? (
                  <div>
                    <label className={`flex items-center gap-2 w-full text-sm border rounded p-3 cursor-pointer hover:bg-gray-50 transition-colors border-dashed border-2 ${editCoverFileError ? 'border-red-500' : 'border-[#4b7c29]'}`}>
                      <Upload className={`w-4 h-4 ${editCoverFileError ? 'text-red-500' : 'text-[#4b7c29]'}`} />
                      <span className="text-gray-600">
                        {editCoverFile ? editCoverFile.name : 'Click here to select image file...'}
                      </span>
                      <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png"
                        className="hidden"
                        disabled={isUploadingEditCover}
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          setEditCoverFile(file);
                          if (file) {
                            const error = validateCoverFile(file);
                            setEditCoverFileError(error);
                          } else {
                            setEditCoverFileError(null);
                          }
                        }}
                        data-testid="input-edit-cover-file"
                      />
                    </label>
                    {editCoverFile && !editCoverFileError && (
                      <p className="text-xs text-green-600 mt-1 font-medium">✓ Selected: {editCoverFile.name} ({(editCoverFile.size / 1024 / 1024).toFixed(1)}MB)</p>
                    )}
                    {editCoverFileError && (
                      <p className="text-xs text-red-500 mt-1 font-medium">✗ {editCoverFileError}</p>
                    )}
                    {isUploadingEditCover && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-sm text-[#4b7c29]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading... {editUploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-[#4b7c29] h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${editUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Max 5MB. Allowed: JPG, PNG only</p>
                  </div>
                ) : (
                  <Input 
                    placeholder="https://drive.google.com/file/d/... or image URL"
                    value={editingAlbum.coverImageUrl}
                    onChange={e => setEditingAlbum({ ...editingAlbum, coverImageUrl: e.target.value })}
                    data-testid="input-edit-cover-url"
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAlbum(null)} disabled={isUploadingEditCover}>Cancel</Button>
            <Button 
              onClick={handleUpdateAlbumWithUpload}
              disabled={updateAlbumMutation.isPending || isUploadingEditCover || !!editCoverFileError}
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
            >
              {isUploadingEditCover ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading {editUploadProgress}%</>
              ) : updateAlbumMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox for fullscreen image viewing */}
      {lightboxOpen && lightboxPhotos.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-50"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 text-white text-lg font-medium">
            {lightboxIndex + 1} / {lightboxPhotos.length}
          </div>

          {/* Previous button */}
          {lightboxPhotos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          {/* Main image */}
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={convertToDirectImageUrl(lightboxPhotos[lightboxIndex]?.imageUrl || '')}
              alt={lightboxPhotos[lightboxIndex]?.caption || ''}
              className="max-w-full max-h-[90vh] object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.retried) {
                  target.dataset.retried = 'true';
                  target.src = lightboxPhotos[lightboxIndex]?.imageUrl || '';
                }
              }}
            />
          </div>

          {/* Next button */}
          {lightboxPhotos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}

          {/* Caption */}
          {lightboxPhotos[lightboxIndex]?.caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center bg-black/50 px-4 py-2 rounded-lg">
              {lightboxPhotos[lightboxIndex].caption}
            </div>
          )}

          {/* Keyboard hint */}
          <div className="absolute bottom-4 right-4 text-white/50 text-sm">
            Use ← → arrows to navigate, ESC to close
          </div>
        </div>
      )}
    </div>
  );
}
