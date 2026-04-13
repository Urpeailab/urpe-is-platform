import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TermsModal } from '../components/TermsModal';

const TermsPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const handleClose = () => {
    // Navigate back to previous page or home
    navigate(-1);
  };

  return <TermsModal isOpen={true} onClose={handleClose} />;
};

export default TermsPage;
