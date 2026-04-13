import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-navy-secondary border-t border-navy-light/20 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* About Column */}
          <div>
            <img 
              src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png" 
              alt="URPE Logo" 
              className="h-12 mb-4"
            />
            <p className="text-slate text-sm">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gold-subtle font-display font-medium mb-4">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-slate hover:text-gold-primary text-sm transition-colors">
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-slate hover:text-gold-primary text-sm transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link to="/eligibility" className="text-slate hover:text-gold-primary text-sm transition-colors">
                  {t('nav.eligibility')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-gold-subtle font-display font-medium mb-4">
              {t('footer.contact')}
            </h3>
            <ul className="space-y-2 text-sm text-slate">
              <li>Email: info@urpe.com</li>
              <li>Phone: +1 (555) 123-4567</li>
            </ul>
          </div>
        </div>

        {/* Gold divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gold-dark/30 to-transparent mb-6"></div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <p className="text-slate-light text-xs mb-2 sm:mb-0">
            © {new Date().getFullYear()} URPE Integral Services. {t('footer.rights')}
          </p>
          
          {/* Discrete Admin Link */}
          <Link 
            to="/admin/login" 
            className="text-navy-light hover:text-slate text-xs transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
};
