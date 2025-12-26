import React, { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, Calendar, Save, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import ChangePasswordForm from "../components/auth/ChangePasswordForm";
import AvatarUpload from "../components/profile/AvatarUpload";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile: React.FC = () => {
  const { user, updateProfile, isLoading, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      phone_number: user?.phone_number || "",
      date_of_birth: user?.date_of_birth || "",
      bio: user?.bio || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile(data);
      setIsEditing(false);
    } catch (error) {
      // Error handled in auth context
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordForm(false);
    // Logout user after successful password change
    setTimeout(() => {
      logout();
    }, 2000);
  };

  const handlePasswordChangeCancel = () => {
    setShowPasswordForm(false);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Profile Settings
          </h1>
          <p className="text-white/70">
            Manage your account information and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="card text-center">
              <div className="mb-4">
                <AvatarUpload isEditing={isEditing} />
              </div>

              <h3 className="text-xl font-semibold text-white mb-1">
                {user?.full_name}
              </h3>
              <p className="text-white/60 mb-4">{user?.email}</p>

              <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
                {user?.is_verified ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500/30">
                    ✓ Verified Account
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    ⚠ Unverified Account
                  </span>
                )}
                {user?.role && (
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${
                      user.role === "admin"
                        ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }`}
                  >
                    {user.role === "admin" ? "👑 Admin" : "👤 User"}
                  </span>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-left space-y-3">
                  <div className="flex items-center text-white/60">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      Joined{" "}
                      {new Date(user?.created_at || "").toLocaleDateString()}
                    </span>
                  </div>
                  {user?.phone_number && (
                    <div className="flex items-center text-white/60">
                      <Phone className="w-4 h-4 mr-2" />
                      <span className="text-sm">{user.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profile Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  Personal Information
                </h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-primary"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button onClick={handleCancel} className="btn-secondary">
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit(onSubmit)}
                      disabled={isLoading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Saving...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        {...register("first_name")}
                        type="text"
                        className="input-field pl-12"
                        disabled={!isEditing}
                      />
                    </div>
                    {errors.first_name && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.first_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        {...register("last_name")}
                        type="text"
                        className="input-field pl-12"
                        disabled={!isEditing}
                      />
                    </div>
                    {errors.last_name && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.last_name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                    <input
                      type="email"
                      value={user?.email || ""}
                      className="input-field pl-12 opacity-50 cursor-not-allowed"
                      disabled
                    />
                  </div>
                  <p className="text-white/50 text-sm mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                    <input
                      {...register("phone_number")}
                      type="tel"
                      className="input-field pl-12"
                      disabled={!isEditing}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                    <input
                      {...register("date_of_birth")}
                      type="date"
                      className="input-field pl-12"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Bio
                  </label>
                  <textarea
                    {...register("bio")}
                    rows={4}
                    className="input-field resize-none"
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </form>
            </div>

            {/* Security Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card mt-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-white">Security</h3>
                  <p className="text-white/60 text-sm">
                    Manage your password and security settings
                  </p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="btn-secondary"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </button>
              </div>

              {showPasswordForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/10 pt-6"
                >
                  <ChangePasswordForm
                    onSuccess={handlePasswordChangeSuccess}
                    onCancel={handlePasswordChangeCancel}
                  />
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
