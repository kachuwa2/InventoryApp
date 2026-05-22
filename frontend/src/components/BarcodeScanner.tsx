import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan:  (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
      if (result) {
        onScan(result.getText());
        onClose();
      }
      if (err && !(err instanceof Error && err.name === 'NotFoundException')) {
        // NotFoundException fires continuously when no barcode is in frame — ignore it
      }
    }).catch(() => {
      setError('Camera access denied. Please allow camera permissions and try again.');
    });

    return () => {
      readerRef.current?.reset();
    };
  }, [onScan, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {error ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-danger" />
            <p className="text-text text-[14px]">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] hover:bg-border transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* Corner brackets */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-sm" />
              <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-sm" />
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-sm" />
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-sm" />

              {/* Scan line */}
              <div className="absolute left-6 right-6 h-0.5 bg-accent/60 scan-line" style={{ top: 0 }} />
            </div>

            <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-[12px]">
              Point camera at barcode
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
