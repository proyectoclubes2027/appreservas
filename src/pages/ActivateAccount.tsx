import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CheckCircle, Search, User } from 'lucide-react';

interface SocioPending {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
}

export default function ActivateAccount() {
  const [searchTerm, setSearchTerm] = useState('');
  const [socios, setSocios] = useState<SocioPending[]>([]);
  const [selectedSocio, setSelectedSocio] = useState<SocioPending | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [realDni, setRealDni] = useState('');
  const [realPhone, setRealPhone] = useState('');
  const [realEmail, setRealEmail] = useState('');
  const [error, setError] = useState('');

  // Buscar socios pendientes (los que tienen email genérico @caec.com)
  useEffect(() => {
    if (searchTerm.length < 3) {
      setSocios([]);
      return;
    }

    const searchSocios = async () => {
      const { data, error } = await supabase
        .from('socios')
        .select('id, nombre, apellido, dni')
        .or(`nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%`)
        .eq('activo', true)
        .filter('email', 'ilike', '%@caec.com%')
        .limit(5);

      if (!error && data) {
        setSocios(data);
      }
    };

    const timer = setTimeout(searchSocios, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSocio) return;
    
    setError('');
    setLoading(true);

    try {
      // 1. Validar que el DNI no exista ya (si es un DNI real)
      const { data: existingDni } = await supabase
        .from('socios')
        .select('id')
        .eq('dni', realDni)
        .single();

      if (existingDni) {
        throw new Error('Este DNI ya está registrado por otro socio.');
      }

      // 2. Actualizar el registro del socio
      const { error: updateError } = await supabase
        .from('socios')
        .update({
          dni: realDni,
          telefono: realPhone,
          email: realEmail,
          estado: 'activo'
        })
        .eq('id', selectedSocio.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al activar la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="bg-success/20 p-6 rounded-full mb-6">
          <CheckCircle className="w-16 h-16 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-2">¡Cuenta Activada!</h1>
        <p className="text-textSec mb-6">
          Ya podés ingresar usando tu DNI real.<br />
          Redirigiendo al login...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-6 relative">
      <div className="absolute top-0 left-0 w-full h-40 bg-primary -z-10 rounded-b-[40px]"></div>
      
      <div className="mt-10 mb-8 flex flex-col items-center">
        <img src="/logo-club.png" alt="Logo" className="w-24 h-auto mb-4" />
        <h1 className="text-2xl font-bold text-center">Activa tu Cuenta de Socio</h1>
        <p className="text-sm text-textSec text-center mt-2">
          Buscate en la lista y completá tus datos reales <br />para poder reservar canchas.
        </p>
      </div>

      {!selectedSocio ? (
        <div className="w-full max-w-md mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-textSec" />
            <input
              type="text"
              placeholder="Escribí tu nombre o apellido..."
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-xl focus:border-primary outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {socios.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSocio(s)}
                className="w-full bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 hover:border-primary transition-all text-left"
              >
                <div className="bg-primary/20 p-2 rounded-lg">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{s.nombre} {s.apellido}</p>
                  <p className="text-xs text-textSec">Socio pendiente de activar</p>
                </div>
              </button>
            ))}
            
            {searchTerm.length >= 3 && socios.length === 0 && (
              <p className="text-center text-sm text-textSec py-4">No encontramos a ningún socio con ese nombre.</p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleActivate} className="w-full max-w-md mx-auto bg-white border border-slate-200 p-6 rounded-xl space-y-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-2">
             <Button variant="ghost" onClick={() => setSelectedSocio(null)} className="p-0 h-auto">← Volver</Button>
             <h2 className="font-bold">Activando cuenta de: {selectedSocio.nombre}</h2>
          </div>

          <Input
            label="Tu DNI Real"
            placeholder="Sin puntos ni espacios"
            value={realDni}
            onChange={(e) => setRealDni(e.target.value)}
            required
          />

          <Input
            label="Tu Teléfono Actual"
            placeholder="Ej: 3364123456"
            value={realPhone}
            onChange={(e) => setRealPhone(e.target.value)}
            required
          />

          <Input
            label="Tu Correo Electrónico"
            placeholder="Para que te lleguen comprobantes"
            type="email"
            value={realEmail}
            onChange={(e) => setRealEmail(e.target.value)}
            required
          />

          {error && <p className="text-blocked text-sm text-center">{error}</p>}

          <Button type="submit" fullWidth disabled={loading || !realDni || !realEmail}>
            {loading ? 'Activando...' : 'Confirmar Datos y Activar'}
          </Button>
        </form>
      )}

      <div className="mt-auto py-8 text-center">
        <Button variant="ghost" onClick={() => navigate('/login')}>
          Ya tengo los datos, quiero ingresar
        </Button>
      </div>
    </div>
  );
}
