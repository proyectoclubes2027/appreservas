import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type Socio = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  rol: 'socio' | 'admin';
  activo: boolean;
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true); // <--- Fix "pantalla negra" by blocking renders while fetching socio
        fetchSocioProfile(session.user);
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
      setSocio(data as Socio);
      setLoading(false);
    } else {
      // El usuario existe en Auth pero NO en la tabla socios.
      // Sign out inmediato para no permitir el ingreso.
      await supabase.auth.signOut();
      setSocio(null);
      setLoading(false);
      // Podríamos disparar un evento global o solo dejarlo en la pantalla de login.
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
