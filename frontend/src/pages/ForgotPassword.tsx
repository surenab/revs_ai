import React from "react";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";
import PerplexityBackground from "../components/PerplexityBackground";

const ForgotPassword: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <PerplexityBackground />
      <div className="w-full max-w-md relative z-10">
        <ForgotPasswordForm />
      </div>
    </div>
  );
};

export default ForgotPassword;
