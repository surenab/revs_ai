import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, X, User } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { api, getMediaUrl } from "../../lib/api";

interface AvatarUploadProps {
  isEditing?: boolean;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ isEditing = false }) => {
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    try {
      setIsUploading(true);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("avatar", file);

      // Upload to backend
      await api.patch("/users/me/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Refresh user data
      await refreshUser();
      toast.success("Avatar updated successfully!");
      setPreviewUrl(null);
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      const message =
        error.response?.data?.avatar?.[0] ||
        error.response?.data?.message ||
        "Failed to upload avatar. Please try again.";
      toast.error(message);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsUploading(true);

      // Send request to remove avatar
      await api.patch("/users/me/", { avatar: null });

      // Refresh user data
      await refreshUser();
      toast.success("Avatar removed successfully!");
    } catch (error: any) {
      console.error("Avatar removal error:", error);
      const message =
        error.response?.data?.message ||
        "Failed to remove avatar. Please try again.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const currentAvatarUrl = previewUrl || getMediaUrl(user?.avatar);

  return (
    <div className="relative inline-block">
      {/* Avatar Display */}
      <div className="relative">
        {currentAvatarUrl ? (
          <motion.img
            src={currentAvatarUrl}
            alt={user?.full_name || "User Avatar"}
            className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-white/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto border-2 border-white/20">
            <User className="w-12 h-12 text-white" />
          </div>
        )}

        {/* Loading Overlay */}
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"
          >
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </motion.div>
        )}

        {/* Edit Button */}
        {isEditing && (
          <motion.button
            onClick={triggerFileInput}
            disabled={isUploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Camera className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Action Buttons (when editing) */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex justify-center space-x-2"
        >
          <button
            onClick={triggerFileInput}
            disabled={isUploading}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>

          {getMediaUrl(user?.avatar) && (
            <button
              onClick={handleRemoveAvatar}
              disabled={isUploading}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
              <span>Remove</span>
            </button>
          )}
        </motion.div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {/* Upload Instructions */}
      {isEditing && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-white/60 text-center mt-2"
        >
          JPG, PNG or GIF (max 5MB)
        </motion.p>
      )}
    </div>
  );
};

export default AvatarUpload;
