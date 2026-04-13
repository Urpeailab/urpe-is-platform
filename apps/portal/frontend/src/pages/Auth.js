import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const Auth = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (mode === 'signin') {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.name, formData.email, formData.phone, formData.password);
      }

      if (result.success) {
        // Save current language preference to user
        const userData = result.data;
        userData.language = i18n.language;
        
        toast.success(mode === 'signin' ? t('auth.welcomeBack') : t('auth.accountCreated'));
        navigate('/dashboard');
      } else {
        toast.error(result.error || t('auth.failed'));
      }
    } catch (error) {
      toast.error(t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-primary text-gold-subtle pt-28 pb-16 px-4">
      <div className="max-w-md mx-auto">
        {/* Back Button - Ley de Fitts: área táctil grande */}
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="mb-6 text-gold-primary hover:text-gold-dark hover:bg-gold-dark/10 min-h-[44px] px-4"
          data-testid="back-button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>

        <Card className="bg-navy-secondary border border-gold-dark/30 rounded-xl shadow-premium">
          <CardHeader className="text-center p-6 sm:p-8 border-b border-navy-light/20">
            <CardTitle className="font-display text-2xl sm:text-3xl font-semibold text-gold-subtle" data-testid="auth-title">
              {t('auth.welcome')}
            </CardTitle>
            <CardDescription className="text-slate mt-2">
              {t('auth.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate text-sm font-medium">
                    {t('auth.name')}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-navy-primary border border-navy-light/30 text-gold-subtle placeholder:text-slate-light focus:border-gold-dark min-h-[48px] text-base"
                    placeholder="John Doe"
                    required
                    data-testid="name-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate text-sm font-medium">
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-navy-primary border border-navy-light/30 text-gold-subtle placeholder:text-slate-light focus:border-gold-dark min-h-[48px] text-base"
                  placeholder="john@example.com"
                  required
                  data-testid="email-input"
                />
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate text-sm font-medium">
                    {t('auth.phone')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-navy-primary border border-navy-light/30 text-gold-subtle placeholder:text-slate-light focus:border-gold-dark min-h-[48px] text-base"
                    placeholder="+1 (555) 000-0000"
                    required
                    data-testid="phone-input"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate text-sm font-medium">
                  {t('auth.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-navy-primary border border-navy-light/30 text-gold-subtle placeholder:text-slate-light focus:border-gold-dark min-h-[48px] text-base"
                  placeholder="••••••••"
                  required
                  data-testid="password-input"
                />
              </div>

              {/* CTA Button - Ley de Fitts: botón grande y prominente */}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-gold-primary hover:bg-gold-dark text-navy-primary font-bold min-h-[52px] text-base shadow-gold hover:shadow-premium-lg transition-all duration-300 mt-6"
                disabled={loading}
                data-testid="auth-submit-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  mode === 'signin' ? t('auth.signIn') : t('auth.signUp')
                )}
              </Button>
            </form>

            {/* Toggle Auth Mode - Ley de Hicks: opciones claras */}
            <div className="mt-6 text-center">
              <p className="text-slate text-sm">
                {mode === 'signin' ? t('auth.noAccount') : t('auth.hasAccount')}
              </p>
              <Button
                variant="link"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-gold-primary hover:text-gold-dark font-semibold min-h-[44px]"
                data-testid="toggle-auth-mode"
              >
                {mode === 'signin' ? t('auth.signUpLink') : t('auth.signInLink')}
              </Button>
            </div>

            {/* Phone Login Option */}
            <div className="mt-4 pt-4 border-t border-navy-light/20">
              <Button
                variant="link"
                onClick={() => navigate('/phone-login')}
                className="text-slate hover:text-gold-primary text-sm w-full min-h-[44px]"
              >
                🔐 Acceso con número de teléfono (usuarios autorizados)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
