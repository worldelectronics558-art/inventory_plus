
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

        // Use a local variable to hold the instance.
        let html5QrCode; 
        
        if (!scannerRef.current) {
            html5QrCode = new Html5Qrcode('qr-code-reader');
            scannerRef.current = html5QrCode;
        } else {
            html5QrCode = scannerRef.current;
        }


        const startScanner = async () => {
            try {
                // Prevent starting if it's already running
                if (html5QrCode.isScanning) return;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText, decodedResult) => {
                        // On successful scan
                        if (isScanning) {
                            html5QrCode.pause();
                            setScannedResult(decodedText);
                            setIsScanning(false);
                        }
                    },
                    (errorMessage) => { /* ignore */ }
                );
            } catch (err) {
                console.error("Scanner start error:", err);
                // Don't alert if the error is "Camera not found" or similar common issues
                if (err && typeof err === 'string' && !err.toLowerCase().includes('not found')) {
                   alert("Could not start camera. Please ensure camera permissions are granted.");
                }
                onClose();
            }
        };

        if (isScanning && !html5QrCode.isScanning) {
            startScanner();
        }

        // Cleanup on component unmount
        return () => {
            const stopScanner = async () => {
                try {
                    // Ensure we have a scanner instance and it's running
                    if (scannerRef.current && scannerRef.current.isScanning) {
                        await scannerRef.current.stop();
                        scannerRef.current = null; // Clear the ref
                    }
                } catch (err) {
                    // This can throw if the scanner is already stopped; it's safe to ignore
                    console.warn("Scanner stop error (safe to ignore):", err);
                }
            };
            stopScanner();
        };
    // The effect should only re-run if isScanning changes from false to true, or on close changes
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
        // The useEffect will handle resuming the scanner
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[100]">
            <div className="relative bg-gray-800 p-4 rounded-lg shadow-xl w-full max-w-lg mx-2">
                
                {/* The QR Code reader viewport */}
                <div id="qr-code-reader" className={`w-full rounded-md overflow-hidden bg-gray-900 transition-all duration-300 ${scannedResult ? 'h-0' : 'h-auto'}`} style={{ minHeight: scannedResult ? '0px' : '250px' }}>
                </div>
                
                {scannedResult ? (
                    <div className="text-center p-4">
                        <p className="text-white font-medium mb-2">Scanned Result:</p>
                        <p className="text-2xl font-bold text-green-400 break-words mb-6">{scannedResult}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={handleScanAgain} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">
                                <RefreshCw size={20} />
                                Scan Again
                            </button>
                            <button onClick={handleConfirm} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500">
                                <CheckCircle size={20} />
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
                    className="absolute top-[-15px] right-[-15px] flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white"
                    aria-label="Close scanner"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default Scanner;

