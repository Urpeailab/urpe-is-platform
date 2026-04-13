import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Mail, Lock, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const { signIn, requestMagicLink } = useAdminAuth();
  
  // Email/Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // OTP state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome back!');
      const role = result.data?.role || result.data?.staff?.role;
      if (role === 'acreditador') {
        navigate('/admin/visa-cases');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!magicEmail) { toast.error('Ingresa tu email'); return; }
    setMagicLoading(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${API}/api/admin/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      setOtpSent(true);
      toast.success('Codigo enviado a tu email');
    } catch (err) {
      toast.error(err.message || 'Error al enviar codigo');
    } finally { setMagicLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) { toast.error('Ingresa el codigo de 6 digitos'); return; }
    setOtpVerifying(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${API}/api/admin/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail, code: otpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Codigo incorrecto');
      // Save token and redirect
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.staff));
      toast.success('Bienvenido!');
      navigate('/admin/dashboard');
      window.location.reload();
    } catch (err) {
      toast.error(err.message || 'Codigo incorrecto');
    } finally { setOtpVerifying(false); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_migrasuite/artifacts/vr2qwbqg_Recurso%2012LOGO.png"
            alt="URPE Logo"
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Admin Panel
          </h1>
          <p className="text-gray-400 mt-2">Sign in to access the dashboard</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Sign In</CardTitle>
            <CardDescription className="text-gray-400">
              Choose your preferred authentication method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic">Acceso por Email</TabsTrigger>
              </TabsList>

              {/* Password Login */}
              <TabsContent value="password">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@urpe.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                {/* Default credentials hint - ONLY IN DEVELOPMENT */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-blue-400">
                        <strong>Admin:</strong><br />
                        Email: admin@urpe.com<br />
                        Password: urpe2024
                      </p>
                    </div>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <p className="text-xs text-purple-400">
                        <strong>Coordinador:</strong><br />
                        Email: test.coordinator@urpe.com<br />
                        Password: coord123
                      </p>
                    </div>
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-xs text-green-400">
                        <strong>Acreditador:</strong><br />
                        Email: acreditador@urpe.com<br />
                        Password: acred2024
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* OTP Login */}
              <TabsContent value="magic">
                {!otpSent ? (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email" className="text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                          id="magic-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={magicEmail}
                          onChange={(e) => setMagicEmail(e.target.value)}
                          className="pl-10 bg-gray-800 border-gray-700 text-white"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={magicLoading}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    >
                      {magicLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" />Enviar Codigo</>
                      )}
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      Te enviaremos un codigo de 6 digitos a tu email
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="text-center mb-2">
                      <Mail className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        Codigo enviado a <strong className="text-white">{magicEmail}</strong>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp-code" className="text-gray-300">Codigo de verificacion</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="bg-gray-800 border-gray-700 text-white text-center text-2xl font-mono tracking-[0.5em]"
                        autoFocus
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={otpVerifying || otpCode.length < 6}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    >
                      {otpVerifying ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
                      ) : (
                        'Ingresar'
                      )}
                    </Button>

                    <div className="flex justify-between">
                      <Button
                        type="button" variant="ghost"
                        onClick={() => { setOtpSent(false); setOtpCode(''); }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        Cambiar email
                      </Button>
                      <Button
                        type="button" variant="ghost"
                        onClick={handleSendOTP}
                        disabled={magicLoading}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        Reenviar codigo
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Back to main site */}
        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white"
          >
            ← Back to main site
          </Button>
        </div>
      </div>
    </div>
  );
};
