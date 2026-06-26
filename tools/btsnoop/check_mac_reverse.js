const fs = require('fs');

const filePath = 'c:\\Users\\blusc\\Desktop\\btsnoop_hci.log';
const targetMAC = '09:34:39:39:29:4D';
const targetMACReverse = '4D:29:39:39:34:09'; // Reversed byte order

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
    // Additional validation: MAC addresses typically have certain patterns
    // First byte's second nibble is often 0, 2, 4, 6, 8, A, C, E for unicast/multicast
    // This is a heuristic, not perfect
    return true;
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

    // Raw byte search for both normal and reversed
    const targetBytes = targetMAC.split(':').map(b => parseInt(b, 16));
    const targetBytesReverse = targetMACReverse.split(':').map(b => parseInt(b, 16));
    
    let normalMatches = 0;
    let reverseMatches = 0;
    
    console.log('\nSearching for normal MAC:', targetMAC);
    for (let i = 0; i < uint8Array.length - 5; i++) {
        let match = true;
        for (let j = 0; j < 6; j++) {
            if (uint8Array[i + j] !== targetBytes[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            normalMatches++;
            if (normalMatches <= 5) {
                console.log(`  Found at offset: ${i} (0x${i.toString(16)})`);
            }
        }
    }
    console.log('Normal MAC matches:', normalMatches);
    
    console.log('\nSearching for reversed MAC:', targetMACReverse);
    for (let i = 0; i < uint8Array.length - 5; i++) {
        let match = true;
        for (let j = 0; j < 6; j++) {
            if (uint8Array[i + j] !== targetBytesReverse[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            reverseMatches++;
            if (reverseMatches <= 5) {
                console.log(`  Found at offset: ${i} (0x${i.toString(16)})`);
            }
        }
    }
    console.log('Reversed MAC matches:', reverseMatches);
    
    // Also search for partial matches (first 3 bytes)
    console.log('\nSearching for partial MAC (first 3 bytes):', targetMAC.split(':').slice(0, 3).join(':'));
    const targetBytesPartial = targetBytes.slice(0, 3);
    let partialMatches = 0;
    
    for (let i = 0; i < uint8Array.length - 2; i++) {
        let match = true;
        for (let j = 0; j < 3; j++) {
            if (uint8Array[i + j] !== targetBytesPartial[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            partialMatches++;
            if (partialMatches <= 10) {
                const context = Array.from(uint8Array.slice(Math.max(0, i - 3), i + 9))
                    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                    .join(' ');
                console.log(`  Found at offset: ${i} (0x${i.toString(16)}) - Context: ...${context}...`);
            }
        }
    }
    console.log('Partial MAC matches:', partialMatches);

} catch (error) {
    console.error('Error:', error.message);
}
