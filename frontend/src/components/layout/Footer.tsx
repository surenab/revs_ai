import React from "react";
import { Link } from "react-router-dom";
import { BarChart3, Github, Mail, Sparkles, Wallet } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t border-white/10 bg-gray-900/50 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <span className="text-xl font-bold text-white">Stocks App</span>
            </div>
            <p className="text-white/60 text-sm">
              Advanced stock market analysis with comprehensive technical
              indicators and real-time data.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/dashboard"
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/stocks"
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Stocks
                  </Link>
                </li>
                <li>
                  <Link
                    to="/indicators"
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Indicators
                  </Link>
                </li>
              </ul>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/patterns"
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Chart Patterns
                  </Link>
                </li>
                <li>
                  <Link
                    to="/profile"
                    className="text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Profile
                  </Link>
                </li>
                {isAuthenticated && (
                  <li>
                    <Link
                      to="/portfolio"
                      className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Portfolio
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/indicators"
                  className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Technical Indicators Guide
                </Link>
              </li>
              <li>
                <Link
                  to="/patterns"
                  className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Chart Patterns Guide
                </Link>
              </li>
              <li>
                <Link
                  to="/contact-support"
                  className="text-white/60 hover:text-white transition-colors text-sm flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © {currentYear} Stocks App. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
