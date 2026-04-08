import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { CheckCircle } from 'lucide-react';

export default function PagoExitoso() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <div className="bg-success/20 p-6 rounded-full mb-6">
        <CheckCircle className="w-16 h-16 text-success" />
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-textPri">¡Pago Recibido!</h1>
      <p className="text-textSec mb-8 text-lg max-w-sm">
        Tu pago ha sido procesado exitosamente. En unos minutos tu cuenta quedará habilitada para reservar.
      </p>

      <div className="w-full max-w-xs space-y-4">
        <Button variant="primary" fullWidth onClick={() => navigate('/reservar')}>
          Volver a Reservas
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate('/mis-turnos')}>
          Ver mis turnos
        </Button>
      </div>

      <p className="mt-12 text-xs text-textSec italic">
        Esta es una página de demostración del sistema automatizado de Mercado Pago para CAEC Tenis.
      </p>
    </div>
  );
}
