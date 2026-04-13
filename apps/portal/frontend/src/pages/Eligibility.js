import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { ArrowLeft, Phone, MessageCircle, Loader2, CheckCircle2, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Footer } from '../components/Footer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const Eligibility = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowLoadingScreen(true);
    setLoadingStep(0);

    // Simulate loading steps with animation
    const loadingSteps = [
      { step: 0, delay: 0 },
      { step: 1, delay: 800 },
      { step: 2, delay: 1600 },
      { step: 3, delay: 2400 }
    ];

    loadingSteps.forEach(({ step, delay }) => {
      setTimeout(() => setLoadingStep(step), delay);
    });

    try {
      // Wait minimum 3 seconds for animation
      const [response] = await Promise.all([
        axios.post(`${API}/eligibility/check-phone`, { 
          phone,
          language: i18n.language 
        }),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      if (response.data.exists) {
        // User exists - set user data with current language and redirect to panel
        const userData = response.data.user;
        userData.language = i18n.language; // Save current language preference
        updateUser(userData);
        setLoadingStep(4); // Success step
        setTimeout(() => {
          toast.success(t('eligibility.phoneFound'));
          navigate('/dashboard?showWelcome=true');
        }, 500);
      } else {
        // User doesn't exist - show WhatsApp option
        setShowLoadingScreen(false);
        const message = response.data.message || t('eligibility.phoneNotFound');
        toast.error(message, { duration: 5000 });
      }
    } catch (error) {
      console.error('Error checking phone:', error);
      setShowLoadingScreen(false);
      toast.error(t('eligibility.error'));
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleWhatsApp = () => {
    // WhatsApp link con mensaje simple
    const message = encodeURIComponent('¡Hola, quiero evaluar mi perfil!');
    const whatsappUrl = `https://wa.me/14705500109?text=${message}`;
    window.open(whatsappUrl, '_blank');
    toast.success(t('eligibility.whatsappRedirect'));
  };

  // Loading steps messages
  const loadingMessages = [
    t('eligibility.loading.step1'),
    t('eligibility.loading.step2'),
    t('eligibility.loading.step3'),
    t('eligibility.loading.step4'),
    t('eligibility.loading.success')
  ];

  // Loading screen component
  if (showLoadingScreen) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <div className="text-center space-y-8">
            {/* Animated Logo/Icon */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-yellow-500/20 animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center h-32">
                {loadingStep < 4 ? (
                  <FileSearch className="h-16 w-16 text-yellow-500 animate-bounce" />
                ) : (
                  <CheckCircle2 className="h-16 w-16 text-success animate-scale-in" />
                )}
              </div>
            </div>

            {/* Loading Message */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {loadingMessages[loadingStep]}
              </h2>
              
              {/* Progress dots */}
              {loadingStep < 4 && (
                <div className="flex justify-center space-x-2">
                  {[0, 1, 2, 3].map((dot) => (
                    <div
                      key={dot}
                      className={`h-2 w-2 rounded-full transition-all duration-300 ${
                        dot <= loadingStep ? 'bg-yellow-500 w-8' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Spinner */}
              {loadingStep < 4 && (
                <Loader2 className="h-8 w-8 text-yellow-500 animate-spin mx-auto" />
              )}
            </div>

            {/* Phone number display */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-400">{t('eligibility.loading.phone')}</p>
              <p className="text-lg font-mono text-yellow-500">{phone}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="mb-6 text-yellow-500 hover:text-yellow-400"
          data-testid="back-home-button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>

        <Card className="bg-black border-2 border-yellow-500/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Phone className="h-8 w-8 text-yellow-500" />
            </div>
            <CardTitle className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="eligibility-title">
              {t('eligibility.title')}
            </CardTitle>
            <CardDescription className="text-gray-300 text-lg">
              {t('eligibility.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white text-lg">
                  {t('eligibility.phoneLabel')}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-white/10 border-yellow-500/50 text-white text-lg h-14"
                  placeholder="+1 (555) 000-0000"
                  required
                  data-testid="phone-input"
                />
                <p className="text-sm text-gray-400">
                  {t('eligibility.phoneHelp')}
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg h-14"
                disabled={loading}
                data-testid="check-eligibility-button"
              >
                {loading ? t('common.loading') : t('eligibility.checkButton')}
              </Button>
            </form>

            {/* WhatsApp Option */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-yellow-500/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-black px-4 text-gray-400">
                  {t('eligibility.or')}
                </span>
              </div>
            </div>

            <Button
              onClick={handleWhatsApp}
              variant="outline"
              size="lg"
              className="w-full border-2 border-success/50 text-success hover:bg-success/10 hover:border-success font-bold text-lg h-14"
              data-testid="whatsapp-button"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              {t('eligibility.whatsappButton')}
            </Button>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-300 text-center">
                {t('eligibility.info')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};
