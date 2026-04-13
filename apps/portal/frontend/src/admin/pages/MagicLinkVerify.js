import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export const MagicLinkVerify = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { verifyMagicLink } = useAdminAuth();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    const verify = async () => {
      const result = await verifyMagicLink(token);
      
      if (result.success) {
        setStatus('success');
        toast.success('Login successful!');
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1500);
      } else {
        setStatus('error');
        toast.error(result.message);
      }
    };

    verify();
  }, [token, verifyMagicLink, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-16 w-16 text-yellow-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Verifying...</h2>
            <p className="text-gray-400">Please wait while we log you in</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
            <p className="text-gray-400">Redirecting to dashboard...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-gray-400 mb-4">The magic link is invalid or expired</p>
            <button
              onClick={() => navigate('/admin/login')}
              className="text-yellow-500 hover:text-yellow-400"
            >
              Return to login
            </button>
          </>
        )}
      </div>
    </div>
  );
};