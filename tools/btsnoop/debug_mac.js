const fs = require('fs');

const filePath = 'c:\\Users\\blusc\\Desktop\\btsnoop_hci.log';

function dataViewToUint32(data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function dataViewToUint64(data, offset) {
    const high = dataViewToUint32(data, offset);
    const low = dataViewToUint32(data, offset + 4);
    return (BigInt(high) << 32n) | BigInt(low);
}

function formatMAC(offset, data) {
    return Array.from(data.slice(offset, offset + 6))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
}

function formatMACReversed(offset, data) {
    return Array.from(data.slice(offset, offset + 6))
        .reverse()
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
}

function isLikelyMAC(data, offset) {
    if (offset + 5 >= data.length) return false;
    const bytes = data.slice(offset, offset + 6);
    
    // MAC addresses are typically not all 00, FF, or the same byte
    const first = bytes[0];
    if (bytes.every(b => b === first)) return false; // All same bytes
    if (bytes.every(b => b === 0x00 || b === 0xFF)) return false; // All 00 or FF
    
    // Additional validation: Check if bytes look like valid MAC patterns
    // First byte's second nibble should be 0, 2, 4, 6, 8, A, C, E (unicast/multicast)
    const firstByte = bytes[0];
    const secondNibble = firstByte & 0x0F;
    const validSecondNibbles = [0x0, 0x2, 0x4, 0x6, 0x8, 0xA, 0xC, 0xE];
    if (!validSecondNibbles.includes(secondNibble)) return false;
    
    // Check for common invalid patterns
    // Avoid sequences that look like protocol headers or counters
    if (bytes[0] === 0xFE && bytes[1] === 0xFE) return false; // Common in Bluetooth
    if (bytes[0] === 0xFF && bytes[1] === 0xFF) return false;
    
    return true;
}

function extractMACAddresses(data) {
    const macs = [];
    const type = data[0];

    // Command packets (0x01)
    if (type === 0x01 && data.length >= 3) {
        const ogf = (data[1] >> 2) & 0x3F;
        const ocf = ((data[1] & 0x03) << 8) | data[2];
        
        if (ogf === 0x01) {
            if ((ocf === 0x0005 || ocf === 0x0009 || ocf === 0x0019) && data.length >= 9 && isLikelyMAC(data, 3)) {
                macs.push(formatMAC(3, data));
            }
        }
        
        if (ogf === 0x08) {
            if ((ocf === 0x000D || ocf === 0x0011 || ocf === 0x0012) && data.length >= 9 && isLikelyMAC(data, 3)) {
                macs.push(formatMAC(3, data));
            }
        }
    }

    // Event packets (0x04)
    if (type === 0x04 && data.length >= 2) {
        const eventCode = data[1];
        
        if (eventCode === 0x03 && data.length >= 11 && isLikelyMAC(data, 5)) {
            macs.push(formatMAC(5, data));
        }
        if (eventCode === 0x04 && data.length >= 9 && isLikelyMAC(data, 3)) {
            macs.push(formatMAC(3, data));
        }
        if (eventCode === 0x07 && data.length >= 10 && isLikelyMAC(data, 4)) {
            macs.push(formatMAC(4, data));
        }
        if (eventCode === 0x3E && data.length >= 14 && isLikelyMAC(data, 8)) {
            macs.push(formatMAC(8, data));
        }
        if (eventCode === 0x3C && data.length >= 3) {
            const numReports = data[2];
            let offset = 3;
            for (let i = 0; i < numReports && offset + 7 < data.length; i++) {
                if (isLikelyMAC(data, offset + 2)) {
                    macs.push(formatMAC(offset + 2, data));
                    macs.push(formatMACReversed(offset + 2, data));
                }
                offset += 2 + 6 + data[offset + 8];
            }
        }
    }

    // ACL data packets (0x02) - MAC addresses are typically in connection handles, not in payload
    // Skip ACL data scanning to avoid false positives from protocol data

    return [...new Set(macs)];
}

try {
    const data = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(data);

    const identification = String.fromCharCode(...uint8Array.slice(0, 8));
    console.log('File identification:', identification);
    
    if (identification !== 'btsnoop\0') {
        console.log('Invalid BTSnoop file format');
        process.exit(1);
    }

    let offset = 16;
    let packetCount = 0;
    let packetsWithMAC = 0;
    const allMACs = new Set();

    while (offset < uint8Array.length) {
        const includedLength = dataViewToUint32(uint8Array, offset + 4);
        const packetData = uint8Array.slice(offset + 24, offset + 24 + includedLength);
        
        packetCount++;
        
        const macs = extractMACAddresses(packetData);
        
        if (macs.length > 0) {
            packetsWithMAC++;
            macs.forEach(mac => allMACs.add(mac));
        }
        
        offset += 24 + includedLength;
    }

    console.log('Total packets:', packetCount);
    console.log('Packets with MAC addresses:', packetsWithMAC);
    console.log('Unique MAC addresses:', allMACs.size);
    console.log('\nAll MAC addresses found:');
    Array.from(allMACs).sort().forEach(mac => console.log('  ', mac));

} catch (error) {
    console.error('Error:', error.message);
}
