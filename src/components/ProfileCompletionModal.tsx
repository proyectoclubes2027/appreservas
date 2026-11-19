import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AlertCircle } from 'lucide-react';

export function ProfileCompletionModal() {
  const { socio } = useAuth();
  const [telefono, setTelefono] = useState(socio?.telefono || '');
  const [email, setEmail] = useState(socio?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!socio) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono || !email) {
      setError('Por favor, completa ambos campos.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Por favor, ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('socios')
        .update({ telefono, email, datos_confirmados: true })
        .eq('id', socio.id);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Este correo ya está en uso por otro socio.');
        }
        throw updateError;
      }

      // Recargar la página para que AuthContext vuelva a buscar el perfil con los datos actualizados
      window.location.reload();
      
    } catch (err: any) {
      console.error('Error actualizando perfil:', err);
      setError(err.message || 'Error al actualizar los datos. Intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl border border-primary/30 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-500"></div>

        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="text-primary w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Confirma tus datos</h2>
        </div>
        
        <p className="text-sm text-textSec mb-6 leading-relaxed">
          Para que el sistema de reservas y avisos funcione correctamente, por favor verifica o actualiza tu número de celular y correo electrónico.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Número de Teléfono / Celular"
            placeholder="Ej: 3415123456"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            type="tel"
            required
          />
          <Input
            label="Correo Electrónico Real"
            placeholder="donde recibirás los comprobantes"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />

          {error && <p className="text-blocked text-sm text-center font-medium bg-blocked/10 p-2 rounded">{error}</p>}

          <Button type="submit" fullWidth disabled={loading || !telefono || !email} className="mt-2">
            {loading ? 'Guardando...' : 'Confirmar Datos'}
          </Button>
        </form>
      </div>
    </div>
  );
}
