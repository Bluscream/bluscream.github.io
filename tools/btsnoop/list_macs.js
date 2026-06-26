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
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
}

function isLikelyMAC(data, offset) {
    if (offset + 5 >= data.length) return false;
    const bytes = data.slice(offset, offset + 6);
    const first = bytes[0];
    if (bytes.every(b => b === first)) return false;
    if (bytes.every(b => b === 0x00 || b === 0xFF)) return false;
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
                }
                offset += 2 + 6 + data[offset + 8];
            }
        }
    }

    // ACL data packets (0x02) - scan payload
    if (type === 0x02 && data.length >= 4) {
        for (let i = 4; i < data.length - 5; i++) {
            if (isLikelyMAC(data, i)) {
                const mac = formatMAC(i, data);
                if (!macs.includes(mac)) {
                    macs.push(mac);
                }
            }
        }
    }

    return [...new Set(macs)];
}

try {
    const data = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(data);

    // Check header
    const identification = String.fromCharCode(...uint8Array.slice(0, 8));
    console.log('File identification:', identification);
    
    if (identification !== 'btsnoop\0') {
        console.log('Invalid BTSnoop file format');
        process.exit(1);
    }

    const version = (uint8Array[8] << 8) | uint8Array[9];
    const dataLinkType = dataViewToUint32(uint8Array, 12);
    console.log('Version:', version);
    console.log('Data Link Type:', dataLinkType);

    // Parse packets
    let offset = 16;
    let packetCount = 0;
    const allMACs = new Map();

    while (offset < uint8Array.length) {
        const originalLength = dataViewToUint32(uint8Array, offset);
        const includedLength = dataViewToUint32(uint8Array, offset + 4);
        const flags = dataViewToUint32(uint8Array, offset + 8);
        const timestamp = dataViewToUint64(uint8Array, offset + 16);
        
        const packetData = uint8Array.slice(offset + 24, offset + 24 + includedLength);
        
        packetCount++;
        
        const macs = extractMACAddresses(packetData);
        
        macs.forEach(mac => {
            if (!allMACs.has(mac)) {
                allMACs.set(mac, { count: 0, firstPacket: packetCount });
            }
            allMACs.get(mac).count++;
        });
        
        offset += 24 + includedLength;
    }

    console.log('\nTotal packets:', packetCount);
    console.log('Unique MAC addresses found:', allMACs.size);
    console.log('\nAll MAC addresses:');
    
    Array.from(allMACs.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([mac, info]) => {
            console.log(`${mac}: ${info.count} occurrences (first at packet #${info.firstPacket})`);
        });

} catch (error) {
    console.error('Error:', error.message);
}
