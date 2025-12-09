import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PhotoUploaderProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (photoUrl: string | null) => void;
  name?: string;
}

export function PhotoUploader({ currentPhotoUrl, onPhotoChange, name = "" }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const compressImage = (file: File, maxWidth: number = 400, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      const compressedDataUrl = await compressImage(file, 400, 0.8);
      setPreviewUrl(compressedDataUrl);
      onPhotoChange(compressedDataUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to process photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={previewUrl || undefined} alt={name} />
          <AvatarFallback className="text-lg bg-primary/10">
            {name ? getInitials(name) : <Camera className="h-8 w-8 text-muted-foreground" />}
          </AvatarFallback>
        </Avatar>
        {previewUrl && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
            onClick={handleRemovePhoto}
            data-testid="button-remove-photo"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-photo-file"
      />
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        data-testid="button-upload-photo"
      >
        {uploading ? (
          <>Uploading...</>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {previewUrl ? 'Change Photo' : 'Upload Photo'}
          </>
        )}
      </Button>
    </div>
  );
}
