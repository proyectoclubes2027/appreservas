import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function Login() {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Si ya hay usuario logueado, redirigí a la raíz para que App.tsx decida
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
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

      if (socioCheck && (socioCheck.activo === false || socioCheck.estado === 'inactivo')) {
        setError('Usuario inactivo. Comunicarse con la Sub Comisión de Tenis.');
        return;
      }

      const email = `${cleanDni}@empalmecentral.com`;
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
        <img src="/empalme-central-logo.png" alt="CAEC Tenis" className="w-[280px] h-auto object-contain mb-8 drop-shadow-md rounded-lg" />

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
          <Input
            label="Contraseña"
            placeholder="Últimos 4 dígitos del DNI (o 1234)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-blocked text-sm text-center">{error}</p>}

          <Button type="submit" fullWidth disabled={loadingLocal || !dni || !password}>
            {loadingLocal ? 'Ingresando...' : 'Ingresar'}
          </Button>



          <p className="text-center text-xs text-textSec mt-4">
            Tu contraseña son los últimos<br /> 4 dígitos de tu DNI
          </p>
        </form>
      </div>
    </div>
  );
}
