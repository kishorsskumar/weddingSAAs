import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ArrowLeft, Filter } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';

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
}

interface PortfolioPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
}

function AlbumGrid() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const { data: albums = [], isLoading } = useQuery<PortfolioAlbum[]>({
    queryKey: ['/api/portfolio/albums'],
  });

  const categories = ['All', ...Array.from(new Set(albums.map(album => album.category)))];
  
  const filteredAlbums = selectedCategory === 'All' 
    ? albums 
    : albums.filter(album => album.category === selectedCategory);

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Our Work</h1>
        <p className="text-gray-600">Explore our recent celebrations and events</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? "bg-[#4b7c29] hover:bg-[#3d6621]" : ""}
            data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 rounded-xl"></div>
              <div className="mt-3 h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="mt-2 h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="text-center py-16">
          <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No portfolio albums found</p>
          {selectedCategory !== 'All' && (
            <Button 
              variant="link" 
              onClick={() => setSelectedCategory('All')}
              className="text-[#4b7c29]"
            >
              View all albums
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAlbums.map(album => (
            <Link key={album.id} href={`/portfolio/${album.id}`}>
              <div className="group cursor-pointer" data-testid={`album-${album.id}`}>
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-4 border-transparent group-hover:border-[#4b7c29] transition-all">
                  <img 
                    src={convertToDirectImageUrl(album.coverImageUrl)} 
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-xl uppercase tracking-wide">{album.title}</h3>
                    {album.tagline && (
                      <p className="text-sm text-white/90 italic mt-1">"{album.tagline}"</p>
                    )}
                    {album.venue && (
                      <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {album.venue}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function AlbumDetail({ albumId }: { albumId: string }) {
  const { data, isLoading } = useQuery<{ album: PortfolioAlbum; photos: PortfolioPhoto[] }>({
    queryKey: [`/api/portfolio/albums/${albumId}`],
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded-xl mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.album) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">Album not found</p>
        <Link href="/portfolio">
          <Button variant="link" className="text-[#4b7c29]">Back to Portfolio</Button>
        </Link>
      </div>
    );
  }

  const { album, photos } = data;

  return (
    <>
      <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
        <img 
          src={convertToDirectImageUrl(album.coverImageUrl)} 
          alt={album.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 md:p-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-wide">{album.title}</h1>
          {album.tagline && (
            <p className="text-lg md:text-xl text-white/90 italic mt-2">"{album.tagline}"</p>
          )}
          {album.venue && (
            <p className="text-white/80 flex items-center gap-2 mt-2">
              <MapPin className="w-4 h-4" /> {album.venue}
            </p>
          )}
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="aspect-square rounded-lg overflow-hidden group cursor-pointer">
              <img 
                src={convertToDirectImageUrl(photo.imageUrl)} 
                alt={photo.caption || album.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => { 
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.retried) {
                    target.dataset.retried = 'true';
                    target.src = photo.imageUrl;
                  } else {
                    target.src = 'https://via.placeholder.com/400x400?text=Image+Not+Found';
                  }
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <p className="text-gray-500">Photos coming soon...</p>
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/portfolio">
          <Button variant="outline" className="border-[#4b7c29] text-[#4b7c29] hover:bg-green-50">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to All Albums
          </Button>
        </Link>
      </div>
    </>
  );
}

export default function PortfolioPage() {
  const [matchAlbum, params] = useRoute('/portfolio/:id');

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/client-portal">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img 
                src="https://client.oakstreetevents.in/assets/logo-CuwGMaVB.png" 
                alt="Oakstreet Events" 
                className="h-10 w-auto"
              />
              <span className="font-semibold text-xl text-gray-900">Portfolio</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {matchAlbum && params?.id ? (
          <AlbumDetail albumId={params.id} />
        ) : (
          <AlbumGrid />
        )}
      </main>

      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <img 
            src="https://client.oakstreetevents.in/assets/logo-CuwGMaVB.png" 
            alt="Oakstreet Events" 
            className="h-12 w-auto mx-auto mb-4 brightness-0 invert"
          />
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Oakstreet Events. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
