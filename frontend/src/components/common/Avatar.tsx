import React from "react";
import { User } from "lucide-react";
import { getMediaUrl } from "../../lib/api";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "User Avatar",
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  const baseClasses = `${sizeClasses[size]} rounded-full object-cover border border-white/20 ${className}`;
  const fullImageUrl = getMediaUrl(src);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Hide the image and show the fallback
    e.currentTarget.style.display = "none";
    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.classList.remove("hidden");
    }
  };

  return (
    <div className="relative inline-block">
      {fullImageUrl && (
        <img
          src={fullImageUrl}
          alt={alt}
          className={baseClasses}
          onError={handleImageError}
        />
      )}
      <div
        className={`${
          sizeClasses[size]
        } bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center ${
          fullImageUrl ? "hidden" : ""
        } ${className}`}
      >
        <User className={`${iconSizes[size]} text-white`} />
      </div>
    </div>
  );
};

export default Avatar;
