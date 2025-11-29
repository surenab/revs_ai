import React, { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import api from "../lib/api";

const contactSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  subject: z
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject must be less than 200 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const ContactSupport: React.FC = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      email: user?.email || "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post("/users/support/", data);
      toast.success(
        response.data.message || "Support request submitted successfully!"
      );
      setIsSubmitted(true);
      reset();
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Failed to submit support request. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Contact Support
          </h1>
          <p className="text-white/70 text-lg">
            We're here to help! Send us your questions, feedback, or issues and
            we'll get back to you as soon as possible.
          </p>
        </motion.div>

        {/* Success Message */}
        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card mb-6 bg-green-500/10 border-green-500/30"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="text-green-400 font-semibold">
                  Request Submitted Successfully!
                </h3>
                <p className="text-white/60 text-sm mt-1">
                  We've received your support request and will respond to you at
                  the email address you provided.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  {...register("email")}
                  type="email"
                  className="input-field pl-12"
                  placeholder="your.email@example.com"
                  disabled={!!user?.email}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.email.message}</span>
                </p>
              )}
              {user?.email && (
                <p className="text-white/50 text-xs mt-1">
                  Using your account email address
                </p>
              )}
            </div>

            {/* Subject Field */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                {...register("subject")}
                type="text"
                className="input-field"
                placeholder="Brief description of your issue or question"
              />
              {errors.subject && (
                <p className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.subject.message}</span>
                </p>
              )}
            </div>

            {/* Message Field */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Message <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-white/60" />
                <textarea
                  {...register("message")}
                  rows={8}
                  className="input-field pl-12 resize-none"
                  placeholder="Please provide as much detail as possible about your issue, question, or feedback..."
                />
              </div>
              {errors.message && (
                <p className="text-red-400 text-sm mt-1 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.message.message}</span>
                </p>
              )}
              <p className="text-white/50 text-xs mt-1">
                Minimum 10 characters, maximum 2000 characters
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <p className="text-white/60 text-sm">
                We typically respond within 24-48 hours
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="card bg-blue-500/10 border-blue-500/30">
            <h3 className="text-white font-semibold mb-2">Response Time</h3>
            <p className="text-white/60 text-sm">
              We aim to respond to all support requests within 24-48 hours
              during business days.
            </p>
          </div>
          <div className="card bg-purple-500/10 border-purple-500/30">
            <h3 className="text-white font-semibold mb-2">What to Include</h3>
            <p className="text-white/60 text-sm">
              Please include relevant details such as error messages, steps to
              reproduce, or screenshots if applicable.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ContactSupport;
