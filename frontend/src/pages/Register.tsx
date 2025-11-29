import React from "react";
import RegisterForm from "../components/auth/RegisterForm";
import PerplexityBackground from "../components/PerplexityBackground";

const Register: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <PerplexityBackground />
      <div className="w-full max-w-md relative z-10">
        <RegisterForm />
      </div>
    </div>
  );
};

export default Register;
