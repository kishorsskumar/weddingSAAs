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
      const uploadRes = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!uploadRes.ok) {
        throw new Error('Failed to get upload URL');
      }
      
      const { uploadURL } = await uploadRes.json();

      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!putRes.ok) {
        throw new Error('Failed to upload file');
      }

      const finalizeRes = await fetch('/api/objects/finalize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadURL }),
      });

      if (!finalizeRes.ok) {
        throw new Error('Failed to finalize upload');
      }

      const { objectPath } = await finalizeRes.json();
      
      setPreviewUrl(objectPath);
      onPhotoChange(objectPath);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo. Please try again.');
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
