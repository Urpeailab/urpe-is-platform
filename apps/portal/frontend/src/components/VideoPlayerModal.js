import React from 'react';
import { X } from 'lucide-react';

// Función para convertir URLs de video a formato embebido
const getEmbedUrl = (url) => {
  if (!url) return null;
  
  // Google Drive
  // Formato: https://drive.google.com/file/d/FILE_ID/view
  // Embed: https://drive.google.com/file/d/FILE_ID/preview
  // Nota: Google Drive NO soporta autoplay
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  
  // YouTube
  // Formato: https://www.youtube.com/watch?v=VIDEO_ID o https://youtu.be/VIDEO_ID
  // Autoplay con mute (navegadores bloquean autoplay con sonido)
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&mute=1`;
  }
  
  // Vimeo
  // Formato: https://vimeo.com/VIDEO_ID
  // Autoplay con muted
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`;
  }
  
  // Si no coincide con ningún formato conocido, devolver la URL original
  return url;
};

export const VideoPlayerModal = ({ isOpen, onClose, videoUrl, title }) => {
  if (!isOpen) return null;
  
  const embedUrl = getEmbedUrl(videoUrl);
  
  if (!embedUrl) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
          <h3 className="text-white font-semibold truncate pr-4">
            {title || 'Video Testimonial'}
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Video Container */}
        <div className="relative pt-[56.25%]">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title || 'Video'}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;
