import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PerplexityBackground from "../PerplexityBackground";

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen relative flex flex-col">
      <PerplexityBackground />
      <Navbar />
      <main className="pt-16 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
