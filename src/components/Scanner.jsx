
// src/components/Scanner.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CheckCircle, RefreshCw } from 'lucide-react';

const Scanner = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef(null);
    const [scannedResult, setScannedResult] = useState(null);
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const html5QrCode = new Html5Qrcode('qr-code-reader');
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText, decodedResult) => {
                        // On successful scan
                        if (isScanning) {
                            setScannedResult(decodedText);
                            setIsScanning(false);
                            if (scannerRef.current && scannerRef.current.isScanning) {
                                scannerRef.current.pause();
                            }
                        }
                    },
                    (errorMessage) => { /* ignore */ }
                );
            } catch (err) {
                console.error("Scanner start error:", err);
                alert("Could not start camera. Please ensure camera permissions are granted.");
                onClose();
            }
        };

        startScanner();

        // Cleanup on component unmount
        return () => {
            const stopScanner = async () => {
                try {
                    if (scannerRef.current && scannerRef.current.isScanning) {
                        await scannerRef.current.stop();
                    }
                } catch (err) {
                    console.warn("Scanner stop error:", err);
                }
            };
            stopScanner();
        };
    }, [isScanning, onClose]);

    const handleConfirm = () => {
        if (scannedResult) {
            onScanSuccess(scannedResult);
        }
        onClose(); 
    };

    const handleScanAgain = () => {
        setScannedResult(null);
        setIsScanning(true);
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[100]">
            <div className="relative bg-gray-800 p-4 rounded-lg shadow-xl w-full max-w-lg mx-2">
                <div id="qr-code-reader" className="w-full rounded-md overflow-hidden bg-gray-900">
                    {!scannedResult && <div style={{height: '400px'}}></div>}
                </div>
                
                {scannedResult ? (
                    <div className="text-center p-4">
                        <p className="text-white font-medium mb-2">Scanned Result:</p>
                        <p className="text-2xl font-bold text-green-400 break-words mb-6">{scannedResult}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={handleScanAgain} className="btn btn-secondary btn-lg">
                                <RefreshCw size={20} className="mr-2"/>
                                Scan Again
                            </button>
                            <button onClick={handleConfirm} className="btn btn-success btn-lg">
                                <CheckCircle size={20} className="mr-2"/>
                                Confirm
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-sm text-gray-300 p-2">
                        Point the camera at a barcode
                    </p>
                )}

                <button
                    onClick={onClose}
                    className="absolute top-[-15px] right-[-15px] btn btn-circle btn-sm bg-red-500 hover:bg-red-600 text-white"
                    aria-label="Close scanner"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default Scanner;
