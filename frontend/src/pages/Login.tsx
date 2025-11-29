import React from "react";
import LoginForm from "../components/auth/LoginForm";
import PerplexityBackground from "../components/PerplexityBackground";

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <PerplexityBackground />
      <div className="w-full max-w-md relative z-10">
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
