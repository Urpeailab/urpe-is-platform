import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrivacyModal } from '../components/PrivacyModal';

const PrivacyPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const handleClose = () => {
    // Navigate back to previous page or home
    navigate(-1);
  };

  return <PrivacyModal isOpen={true} onClose={handleClose} />;
};

export default PrivacyPage;
