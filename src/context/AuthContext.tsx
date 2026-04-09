import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type Socio = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  rol: 'socio' | 'admin';
  activo: boolean;
  estado?: string;
  created_at: string;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  socio: Socio | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [socio, setSocio] = useState<Socio | null>(null);
  const [loading, setLoading] = useState(true);

  const socioRef = useRef<Socio | null>(null);

  useEffect(() => {
    socioRef.current = socio;
  }, [socio]);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchSocioProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (!socioRef.current || event === 'SIGNED_IN') {
          setLoading(true);
          fetchSocioProfile(session.user);
        }
      } else {
        setSocio(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSocioProfile = async (authUser: User) => {
    const email = authUser.email;
    if (!email) {
      setLoading(false);
      return;
    }
    
    const dni = email.split('@')[0];
    const { data, error } = await supabase
      .from('socios')
      .select('*')
      .eq('dni', dni)
      .single();

    if (!error && data) {
      const socioData = data as Socio;
      // Validar que el socio realmente esté ACTIVO antes de dejarlo pasar
      if (socioData.activo === false || socioData.estado === 'inactivo') {
         await supabase.auth.signOut();
         setSocio(null);
         setLoading(false);
         // Podríamos tirar un evento global, pero se redirige al login.
         return;
      }
      setSocio(socioData);
      setLoading(false);
    } else {
      // El usuario existe en Auth pero NO en la tabla socios, o no se encontró
      // Sign out inmediato para no permitir el ingreso.
      await supabase.auth.signOut();
      setSocio(null);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, socio, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
