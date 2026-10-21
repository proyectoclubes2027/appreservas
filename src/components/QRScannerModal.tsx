import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedCanchaId: number;
  canchaNombre: string;
  onSuccess: () => Promise<void> | void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  expectedCanchaId,
  canchaNombre,
  onSuccess,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(false);

    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        // Pequeño timeout para asegurar que el div esté en el DOM
        await new Promise((r) => setTimeout(r, 150));

        html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          async (decodedText) => {
            await handleScan(decodedText);
          },
          () => {
            // Callback opcional de frames descartados
          }
        );
      } catch (err: any) {
        console.error('Error al iniciar la cámara para QR:', err);
        setErrorMsg('No se pudo acceder a la cámara. Por favor asegurate de dar permisos en tu navegador/celular.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch((e) => console.warn('Error al detener scanner:', e));
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleScan = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const cleanCode = code.trim().toUpperCase();
    const expected = `CAEC-CANCHA-${expectedCanchaId}`;

    if (cleanCode === expected) {
      setSuccessMsg(`¡Código QR verificado correctamente!`);
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.warn('Stop failed', e);
        }
      }
      setTimeout(async () => {
        await onSuccess();
        onClose();
      }, 1200);
    } else if (cleanCode.startsWith('CAEC-CANCHA-')) {
      const scannedId = cleanCode.replace('CAEC-CANCHA-', '');
      setErrorMsg(`Escaneaste el QR de la Cancha ${scannedId}, pero tu turno es en ${canchaNombre}.`);
      setIsProcessing(false);
    } else {
      setErrorMsg('El código QR escaneado no pertenece a las canchas del club.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 flex flex-col relative shadow-2xl">
        {/* Encabezado */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Camera className="text-primary w-6 h-6" />
            <div>
              <h3 className="text-base font-bold text-textPri">Validar Turno</h3>
              <p className="text-xs text-textSec">Cancha: <span className="text-primary font-semibold">{canchaNombre}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-textSec hover:text-textPri hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensaje instructivo */}
        <p className="text-xs text-textSec mb-3">
          Apuntá tu cámara al código QR ubicado físicamente en <strong className="text-textPri">{canchaNombre}</strong>.
        </p>

        {/* Visor de la Cámara */}
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-[#2a2a2a] flex items-center justify-center">
          <div id={readerElementId} className="w-full h-full" />
          {successMsg && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-center text-emerald-400 gap-2 animate-[fadeIn_0.2s]">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <p className="font-bold text-sm">{successMsg}</p>
            </div>
          )}
        </div>

        {/* Mensajes de error */}
        {errorMsg && (
          <div className="mt-3 p-3 bg-red-950/50 border border-red-500/50 rounded-lg flex items-start gap-2 text-red-300 text-xs animate-[shake_0.2s]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
