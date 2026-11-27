import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  className = 'w-full h-48 object-cover',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 border border-slate-200 ${className}`}
      >
        <ImageIcon className="w-6 h-6 mb-1.5" />
        <span className="text-xs text-slate-500 px-3 text-center truncate max-w-full">
          {fallbackLabel || alt || 'No image attached'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
