import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';

const LOGO_URL = process.env.REACT_APP_LOGO_URL || 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(formData);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')} 
        className="auth-back-btn"
        data-testid="back-to-landing"
      >
        <ArrowLeft className="mr-2" size={18} />
        {t('form.back')}
      </Button>

      <div className="auth-content">
        <div className="auth-logo">
          <img src={LOGO_URL} alt="Monica Logo" className="logo-image-large" />
          <h1 className="auth-title">Monica</h1>
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle>{t('auth.login')}</CardTitle>
            <CardDescription>{t('landing.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-field">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="email-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="email@example.com"
                />
              </div>

              <div className="form-field">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="password-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="••••••••"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="auth-submit-btn"
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    {t('dashboard.loading')}
                  </>
                ) : (
                  t('auth.signIn')
                )}
              </Button>
            </form>

            <div className="auth-footer">
              <p>
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="auth-link">
                  {t('auth.signUp')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;