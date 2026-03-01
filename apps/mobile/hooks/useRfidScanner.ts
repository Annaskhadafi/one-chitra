import { useState, useCallback } from "react";
import { TextInput } from "react-native";

/**
 * Hook untuk Keyboard Wedge RFID Scanner.
 * 
 * Cara kerja:
 * - Device Qimtronics dalam mode Keyboard Wedge akan mengirim Tag ID
 *   seperti ketikan keyboard ke field yang sedang aktif.
 * - Hook ini menyediakan ref TextInput yang harus di-attach ke input RFID.
 * - Saat trigger ditekan, Tag ID akan masuk ke inputRef dan onScan dipanggil.
 * 
 * Saat device Intent tiba (nanti di-upgrade), cukup ganti hook ini saja.
 */
export function useRfidScanner(onScan: (tagId: string) => void) {
    const [tagId, setTagId] = useState("");
    const [isScanning, setIsScanning] = useState(false);

    const handleTextChange = useCallback(
        (text: string) => {
            setTagId(text);

            // RFID scanner biasanya kirim karakter selesai dengan Enter/newline
            // atau langsung akhiri setelah delay singkat
            // Di sini kita detect dengan panjang tag (EPC biasanya 24 hex chars)
            if (text.length >= 24 && !text.includes(" ")) {
                setIsScanning(false);
                onScan(text.trim());
                // Reset setelah scan
                setTimeout(() => setTagId(""), 300);
            }
        },
        [onScan]
    );

    const startScanning = useCallback(() => {
        setIsScanning(true);
        setTagId("");
    }, []);

    const stopScanning = useCallback(() => {
        setIsScanning(false);
    }, []);

    const manualInput = useCallback(
        (text: string) => {
            if (text.trim()) {
                onScan(text.trim());
            }
        },
        [onScan]
    );

    return {
        tagId,
        isScanning,
        handleTextChange,
        startScanning,
        stopScanning,
        manualInput,
    };
}
