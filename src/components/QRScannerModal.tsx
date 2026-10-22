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
  const hasScannedRef = useRef(false);
  const readerElementId = 'qr-reader-container';

  const stopCameraSafely = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    try {
      // 1. Liberar la pista del stream del video manualmente (vital en Android para no colgar WebGL/hardware)
      const container = document.getElementById(readerElementId);
      if (container) {
        const video = container.querySelector('video') as HTMLVideoElement | null;
        if (video) {
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (_) {
                // ignore
              }
            });
            video.srcObject = null;
          }
          video.pause();
        }
      }

      // 2. Detener scanner de html5-qrcode sólo si sigue escaneando
      if (scanner && (scanner as any).isScanning) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn('Detención segura de cámara:', err);
    }

    try {
      if (scanner) {
        scanner.clear();
      }
    } catch (_) {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(false);
    hasScannedRef.current = false;

    let isSubscribed = true;

    const startScanner = async () => {
      try {
        await new Promise((r) => setTimeout(r, 200));
        if (!isSubscribed) return;

        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {
            // Ignorar frames descartados
          }
        );
      } catch (err: any) {
        console.error('Error al iniciar cámara:', err);
        if (isSubscribed) {
          setErrorMsg('No se pudo acceder a la cámara. Por favor verificá los permisos en tu navegador/celular.');
        }
      }
    };

    startScanner();

    return () => {
      isSubscribed = false;
      stopCameraSafely();
    };
  }, [isOpen]);

  const handleScan = async (code: string) => {
    // Si ya procesó o está en curso, descartar frames subsecuentes
    if (hasScannedRef.current || isProcessing) return;

    const cleanCode = (code || '').trim().toUpperCase();
    const expected = `CAEC-CANCHA-${expectedCanchaId}`;

    // Acepta si es "CAEC-CANCHA-X" o si forma parte de una URL
    const isMatch = cleanCode === expected || cleanCode.includes(expected);

    if (isMatch) {
      hasScannedRef.current = true;
      setIsProcessing(true);
      setSuccessMsg('¡Código QR verificado correctamente!');

      // Detener cámara de inmediato para liberar recursos
      await stopCameraSafely();

      setTimeout(async () => {
        try {
          await onSuccess();
        } catch (err) {
          console.error('Error ejecutando onSuccess:', err);
        } finally {
          onClose();
        }
      }, 1000);
    } else if (cleanCode.includes('CAEC-CANCHA-')) {
      const match = cleanCode.match(/CAEC-CANCHA-(\d+)/);
      const scannedId = match ? match[1] : '';
      setErrorMsg(`Escaneaste el QR de la Cancha ${scannedId}, pero tu turno es en ${canchaNombre}.`);
    } else {
      setErrorMsg('El código QR escaneado no pertenece a las canchas del club.');
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
            onClick={() => {
              stopCameraSafely();
              onClose();
            }}
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
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              stopCameraSafely();
              onClose();
            }}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
