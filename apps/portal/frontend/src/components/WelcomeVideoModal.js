import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getDisplayName } from '../utils/userUtils';
import axios from 'axios';
import { 
  Play, 
  CheckCircle2, 
  X,
  Volume2,
  Pause,
  Check
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const WelcomeVideoModal = ({ onClose }) => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Get advisor info
  const advisor = user?.advisor || {
    name: t('monica.defaultAdvisor'),
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Advisor&backgroundColor=ffc700',
    title: t('monica.advisorTitle')
  };

  // Simulate video playback
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 2;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  // Auto-advance steps based on progress
  useEffect(() => {
    if (progress > 30 && currentStep === 0) setCurrentStep(1);
    if (progress > 60 && currentStep === 1) setCurrentStep(2);
    if (progress > 90 && currentStep === 2) setCurrentStep(3);
  }, [progress, currentStep]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleComplete = async () => {
    try {
      // Get token from localStorage
      const userData = JSON.parse(localStorage.getItem('urpe_user'));
      const token = userData?.token;
      
      if (token) {
        // Call backend to mark welcome as seen
        await axios.post(
          `${BACKEND_URL}/api/auth/mark-welcome-seen`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        console.log('✅ Welcome marked as seen in database');
        
        // Update user object in localStorage and context
        const updatedUser = { ...userData, welcome: true };
        localStorage.setItem('urpe_user', JSON.stringify(updatedUser));
        updateUser(updatedUser);
      }
    } catch (error) {
      console.error('❌ Error marking welcome as seen:', error);
      // Don't block closing the modal if API call fails
    }
    
    // Close modal
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className="bg-white border-2 border-yellow-500 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <CardHeader className="relative">
          <Button
            onClick={handleComplete}
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-gray-600 hover:text-black"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-yellow-500 text-black">
              {t('welcomeVideo.exclusive')}
            </Badge>
            <Badge className="bg-gray-100 text-gray-900 border border-gray-300">
              {t('welcomeVideo.personalMessage')}
            </Badge>
          </div>
          <CardTitle className="text-2xl text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('welcomeVideo.title', { name: getDisplayName(user) })}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Video Player Simulation */}
          <div className="relative bg-gradient-to-br from-yellow-500/20 to-gray-100 rounded-lg overflow-hidden border-2 border-yellow-500/50">
            {/* Video Content */}
            <div className="aspect-video relative bg-gray-50">
              {/* Advisor Image */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="h-48 w-48 rounded-full border-4 border-yellow-500 overflow-hidden bg-white">
                    <img 
                      src={advisor.photo}
                      alt={advisor.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {isPlaying && (
                    <div className="absolute -bottom-2 -right-2 bg-yellow-500 rounded-full p-2 animate-pulse">
                      <Volume2 className="h-6 w-6 text-black" />
                    </div>
                  )}
                </div>
              </div>

              {/* Play/Pause Overlay */}
              {!isPlaying && progress === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Button
                    onClick={handlePlayPause}
                    size="lg"
                    className="h-20 w-20 rounded-full bg-yellow-500 hover:bg-yellow-400"
                  >
                    <Play className="h-10 w-10 text-black ml-1" />
                  </Button>
                </div>
              )}

              {/* Advisor Name Overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/50 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{advisor.name}</h3>
                      <p className="text-xs text-gray-600">{advisor.title}</p>
                    </div>
                    {progress > 0 && (
                      <Button
                        onClick={handlePlayPause}
                        size="sm"
                        variant="ghost"
                        className="text-yellow-500 hover:bg-yellow-50"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Video Script/Captions */}
          <Card className="bg-gray-50 border border-yellow-500/30">
            <CardContent className="p-4">
              <p className="text-gray-700 text-lg font-semibold text-center">
                {t('welcomeVideo.mainMessage', { name: getDisplayName(user) })}
              </p>
            </CardContent>
          </Card>

          {/* URPE es para ti si... */}
          <Card className="bg-gradient-to-br from-yellow-50 to-white border-2 border-yellow-500">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                {t('welcomeVideo.forYouTitle')}
              </h3>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-black" />
                    </div>
                    <p className="text-gray-700 flex-1">
                      {t(`welcomeVideo.forYou${num}`)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleComplete}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              size="lg"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {progress >= 100 ? t('welcomeVideo.letsStart') : t('welcomeVideo.skipForNow')}
            </Button>
            {progress < 100 && progress > 0 && (
              <Button
                onClick={handlePlayPause}
                variant="outline"
                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                size="lg"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
