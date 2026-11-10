import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle2, SwitchCamera, MapPin, Loader2, Navigation } from 'lucide-react';
import { Button } from './ui/Button';
import { CLUB_COORDINATES, calcularDistanciaMetros } from '../lib/geoValidation';

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
  const [activeTab, setActiveTab] = useState<'qr' | 'gps'>('qr');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [verifyingGps, setVerifyingGps] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const readerElementId = 'qr-reader-container';

  const stopCameraSafely = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    try {
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

  // 1. Obtener lista de cámaras disponibles al abrir
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Cámara ${d.id}` })));
        }
      })
      .catch((e) => {
        console.warn('No se pudieron listar cámaras disponibles:', e);
      });
  }, [isOpen]);

  // 2. Iniciar escáner QR con optimizaciones avanzadas para iOS y Android
  useEffect(() => {
    if (!isOpen || activeTab !== 'qr') {
      stopCameraSafely();
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(false);
    hasScannedRef.current = false;

    let isSubscribed = true;

    const startScanner = async () => {
      try {
        await new Promise((r) => setTimeout(r, 200));
        if (!isSubscribed) return;

        // experimentalFeatures: useBarCodeDetectorIfSupported activa el chip nativo de Apple en iPhones
        const html5QrCode = new Html5Qrcode(readerElementId, {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        } as any);

        scannerRef.current = html5QrCode;

        // Configuración de escaneo de pantalla completa con mayor framerate
        const config: any = {
          fps: 20, // Mayor fluidez para captar frames nítidos en movimiento
          // Al no restringir qrbox rígidamente, analiza dinámicamente todo el marco visual
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.82); // 82% del marco
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        };

        const cameraConfig = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : {
              facingMode: 'environment', // Preferir trasera
              focusMode: 'continuous',   // Autofocus continuo si está disponible
              advanced: [{ focusMode: 'continuous' }],
            };

        await html5QrCode.start(
          cameraConfig as any,
          config,
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {
            // Ignorar frames intermedios
          }
        );
      } catch (err: any) {
        console.error('Error al iniciar cámara:', err);
        if (isSubscribed) {
          setErrorMsg('No se pudo acceder a la cámara. Podés usar la pestaña de Ubicación (GPS) o revisar permisos.');
        }
      }
    };

    startScanner();

    return () => {
      isSubscribed = false;
      stopCameraSafely();
    };
  }, [isOpen, activeTab, selectedCameraId]);

  const handleScan = async (code: string) => {
    if (hasScannedRef.current || isProcessing) return;

    const cleanCode = (code || '').trim().toUpperCase();
    const expected = `CAEC-CANCHA-${expectedCanchaId}`;

    const isMatch = cleanCode === expected || cleanCode.includes(expected);

    if (isMatch) {
      hasScannedRef.current = true;
      setIsProcessing(true);
      setSuccessMsg('¡Código QR verificado correctamente!');

      await stopCameraSafely();

      setTimeout(async () => {
        try {
          await onSuccess();
        } catch (err) {
          console.error('Error ejecutando onSuccess:', err);
        } finally {
          onClose();
        }
      }, 900);
    } else if (cleanCode.includes('CAEC-CANCHA-')) {
      const match = cleanCode.match(/CAEC-CANCHA-(\d+)/);
      const scannedId = match ? match[1] : '';
      setErrorMsg(`Escaneaste el QR de la Cancha ${scannedId}, pero tu turno es en ${canchaNombre}.`);
    } else {
      setErrorMsg('El código QR escaneado no pertenece a las canchas del club.');
    }
  };

  // Alternar entre cámaras disponibles (útil en iPhones con multi-lente)
  const handleToggleCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  // Validación por Ubicación / GPS (Opción 4)
  const handleValidateGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Tu celular o navegador no soporta geolocalización.');
      return;
    }

    setVerifyingGps(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distancia = calcularDistanciaMetros(
          latitude,
          longitude,
          CLUB_COORDINATES.latitude,
          CLUB_COORDINATES.longitude
        );

        // Si la precisión es razonable y está dentro del radio del club
        if (distancia <= CLUB_COORDINATES.maxDistanceMeters) {
          setSuccessMsg(`¡Ubicación confirmada! Estás en el club (a ${Math.round(distancia)}m de las canchas).`);
          setIsProcessing(true);

          setTimeout(async () => {
            try {
              await onSuccess();
            } catch (err) {
              console.error('Error onSuccess GPS:', err);
            } finally {
              onClose();
            }
          }, 1000);
        } else {
          setVerifyingGps(false);
          setErrorMsg(
            `Estás a ${Math.round(distancia)} metros del club. Para validar tu presencia mediante GPS debes estar físicamente en el predio.`
          );
        }
      },
      (geoError) => {
        setVerifyingGps(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setErrorMsg('Permiso de ubicación denegado. Habilitá la ubicación en tu navegador para validar por GPS.');
        } else {
          setErrorMsg('No se pudo obtener tu ubicación actual. Probá acercándote a cielo abierto o con el lector QR.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 flex flex-col relative shadow-2xl">
        {/* Encabezado */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Camera className="text-primary w-6 h-6" />
            <div>
              <h3 className="text-base font-bold text-textPri">Validar Turno</h3>
              <p className="text-xs text-textSec">
                Cancha: <span className="text-primary font-semibold">{canchaNombre}</span>
              </p>
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

        {/* Selector de Método: Escáner QR vs Ubicación GPS */}
        <div className="grid grid-cols-2 gap-1 bg-[#121212] p-1 rounded-xl border border-[#2a2a2a] mb-3">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setActiveTab('qr');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-primary text-black shadow-md'
                : 'text-textSec hover:text-white'
            }`}
          >
            <Camera size={14} />
            <span>Escanear QR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              stopCameraSafely();
              setActiveTab('gps');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gps'
                ? 'bg-primary text-black shadow-md'
                : 'text-textSec hover:text-white'
            }`}
          >
            <MapPin size={14} />
            <span>Estoy en el Club</span>
          </button>
        </div>

        {/* MÉTODO 1: ESCÁNER QR OPTIMIZADO */}
        {activeTab === 'qr' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-textSec">
                Apuntá al código QR ubicado en <strong className="text-textPri">{canchaNombre}</strong>.
              </p>
              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="text-[11px] flex items-center gap-1 text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                  title="Cambiar lente / cámara"
                >
                  <SwitchCamera size={12} />
                  <span>Cambiar lente</span>
                </button>
              )}
            </div>

            {/* Visor de la Cámara */}
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-[#2a2a2a] flex items-center justify-center">
              <div id={readerElementId} className="w-full h-full" />
              {successMsg && (
                <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center p-4 text-center text-emerald-400 gap-2 animate-[fadeIn_0.2s] z-10">
                  <CheckCircle2 size={48} className="text-emerald-400" />
                  <p className="font-bold text-sm">{successMsg}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* MÉTODO 2: VALIDACIÓN POR GPS */}
        {activeTab === 'gps' && (
          <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-5 flex flex-col items-center text-center space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Navigation className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-textPri">Confirmación por Ubicación</h4>
              <p className="text-xs text-textSec leading-relaxed">
                Si tenés problemas con la cámara o el reflejo del sol, podés validar tu turno confirmando que estás físicamente dentro del predio de tenis del club.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={handleValidateGps}
              disabled={verifyingGps || isProcessing}
              fullWidth
              className="h-11 font-bold text-xs flex items-center justify-center gap-2"
            >
              {verifyingGps ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando ubicación GPS...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Validar presencia con mi Ubicación
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mensajes de éxito */}
        {successMsg && activeTab === 'gps' && (
          <div className="mt-3 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg flex items-center gap-2 text-emerald-300 text-xs animate-[fadeIn_0.2s]">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

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
