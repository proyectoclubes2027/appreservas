import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Si ya hay usuario logueado, redirigí a la raíz para que App.tsx decida
  useEffect(() => {
    // Verificar si venimos rebotados por inactividad
    const authError = sessionStorage.getItem('auth_error');
    if (authError === 'inactive') {
      setError('Usuario inactivo. Comunicarse con la Sub Comisión de Tenis.');
      sessionStorage.removeItem('auth_error');
    }

    if (user) {
      const redirectUrl = sessionStorage.getItem('post_login_redirect');
      if (redirectUrl) {
        sessionStorage.removeItem('post_login_redirect');
        navigate(redirectUrl, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanDni = dni.trim();
    const cleanPassword = password.trim();

    // Validar contraseña
    if (cleanDni !== 'admin' && cleanPassword !== cleanDni.slice(-4)) {
      setError('La contraseña debe ser los últimos 4 dígitos de tu DNI.');
      return;
    }
    
    setLoadingLocal(true);

    try {
      // 1. Verificar primero si el socio existe y está activo
      const { data: socioCheck, error: checkError } = await supabase
        .from('socios')
        .select('activo, estado')
        .eq('dni', cleanDni)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is 'no rows'
        throw new Error('Error al verificar socio: ' + checkError.message);
      }

      if (socioCheck && socioCheck.estado === 'inactivo') {
        setError('Usuario inactivo. Comunicarse con la Sub Comisión de Tenis.');
        return;
      }

      const email = `${cleanDni}@gmail.com`;
      const authPassword = `${cleanDni}${cleanPassword}`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          // Si no existe el usuario en Auth, intentamos registrarlo (solo si existe en socios y es activo)
          if (!socioCheck) {
            setError('No se encontró un socio con ese DNI. Verifica los datos.');
            return;
          }

          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
            email, 
            password: authPassword 
          });
          
          if (signUpError) {
            setError('Error al crear perfil en Auth: ' + signUpError.message);
          } else if (signUpData?.user && !signUpData.session) {
            setError('⚠️ Error de configuración: "Confirm email" está activado en Supabase.');
          }
          // Si el registro es exitoso, AuthContext tomará el relevo
        } else {
          setError(signInError.message);
        }
      } 
      // Si el login es exitoso, el useEffect de Login.tsx o el AuthContext redirigirán al usuario.
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      <div className="absolute top-0 w-full h-1/2 bg-primary -z-10 rounded-b-[40px]"></div>

      <div className="w-full max-w-sm flex flex-col items-center mt-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0d0d0d] border border-primary/40 flex items-center justify-center shadow-xl mb-3">
            <span className="text-2xl font-black text-primary tracking-wider">🎾</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#0d0d0d] uppercase">
            Club Deportivo Central
          </h1>
          <p className="text-xs font-bold text-[#0d0d0d]/80 uppercase tracking-widest mt-0.5">
            Sistema de Turnos y Reservas
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full bg-[#161616] border border-[#2a2a2a] p-6 rounded-xl flex flex-col gap-6 shadow-xl">
          <Input
            label="Número de DNI"
            placeholder="Ej: 28456789 (o admin)"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            required
            type="text"
            inputMode="text"
          />
          <div className="relative">
            <Input
              label="Contraseña"
              placeholder="Últimos 4 dígitos del DNI (o 1234)"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-[#555] hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && <p className="text-blocked text-sm text-center">{error}</p>}

          <Button type="submit" fullWidth disabled={loadingLocal || !dni || !password}>
            {loadingLocal ? 'Ingresando...' : 'Ingresar'}
          </Button>

          {deferredPrompt && (
            <Button 
              type="button" 
              variant="secondary" 
              fullWidth 
              onClick={handleInstallClick}
              className="mt-2 border-primary text-primary"
            >
              Instalar Aplicación
            </Button>
          )}

          <div className="flex flex-col gap-1 mt-4 text-center">
            <p className="text-xs text-textSec">
              Tu contraseña son los últimos<br /> 4 dígitos de tu DNI
            </p>
            {/* Hint for iOS users who don't see the button */}
            <p className="text-[10px] text-[#555] italic lg:hidden">
              En iPhone: Tocar Compartir y "Añadir a pantalla de inicio"
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
