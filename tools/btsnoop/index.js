let packets = [];
let filteredPackets = [];
let currentPage = 1;
const pageSize = 50;

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const filters = document.getElementById('filters');
    const packetTable = document.getElementById('packetTable');
    const packetBody = document.getElementById('packetBody');
    const packetDetail = document.getElementById('packetDetail');
    const detailContent = document.getElementById('detailContent');

    fileInput.addEventListener('change', handleFile);
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('closeDetail').addEventListener('click', () => packetDetail.classList.add('hidden'));

    // Drag and drop support
    const dropZone = document.getElementById('dropZone');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            handleFile({ target: { files: [file] } });
        }
    });
});

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        parseBTSnoop(data, file);
    };
    reader.readAsArrayBuffer(file);
}

function parseBTSnoop(data, file) {
    try {
        // Parse header
        const identification = String.fromCharCode(...data.slice(0, 8));
        if (identification !== 'btsnoop\0') {
            throw new Error('Invalid BTSnoop file format');
        }

        const version = dataViewToUint16(data, 8);
        const dataLinkType = dataViewToUint32(data, 12);

        // Display file info
        document.getElementById('fileDetails').innerHTML = `
            <div><strong>Filename:</strong> ${file.name}</div>
            <div><strong>Size:</strong> ${formatBytes(file.size)}</div>
            <div><strong>Identification:</strong> ${identification}</div>
            <div><strong>Version:</strong> ${version}</div>
            <div><strong>Data Link Type:</strong> ${dataLinkType}</div>
        `;
        fileInfo.classList.remove('hidden');

        // Parse packets
        packets = [];
        let offset = 16;

        while (offset < data.length) {
            const originalLength = dataViewToUint32(data, offset);
            const includedLength = dataViewToUint32(data, offset + 4);
            const flags = dataViewToUint32(data, offset + 8);
            const cumulativeDrops = dataViewToUint32(data, offset + 12);
            const timestamp = dataViewToUint64(data, offset + 16);
            
            const packetData = data.slice(offset + 24, offset + 24 + includedLength);
            
            const packet = {
                index: packets.length + 1,
                originalLength,
                includedLength,
                flags,
                cumulativeDrops,
                timestamp,
                data: packetData,
                direction: (flags & 0x01) ? 'sent' : 'received',
                type: getPacketType(packetData),
                macAddresses: extractMACAddresses(packetData)
            };

            packets.push(packet);
            offset += 24 + includedLength;
        }

        filteredPackets = [...packets];
        filters.classList.remove('hidden');
        packetTable.classList.remove('hidden');
        displayPackets();

    } catch (error) {
        alert('Error parsing file: ' + error.message);
    }
}

function extractMACAddresses(data) {
    const macs = [];
    
    // Helper to check if a sequence looks like a MAC address
    function isLikelyMAC(offset) {
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

    function formatMAC(offset) {
        return Array.from(data.slice(offset, offset + 6))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(':')
            .toUpperCase();
    }

    function formatMACReversed(offset) {
        return Array.from(data.slice(offset, offset + 6))
            .reverse()
            .map(b => b.toString(16).padStart(2, '0'))
            .join(':')
            .toUpperCase();
    }

    const type = data[0];

    // Command packets (0x01)
    if (type === 0x01 && data.length >= 3) {
        const ogf = (data[1] >> 2) & 0x3F;
        const ocf = ((data[1] & 0x03) << 8) | data[2];
        
        // Link Control Commands (OGF 0x01)
        if (ogf === 0x01) {
            // Create Connection (OCF 0x0005) - MAC at offset 3
            if (ocf === 0x0005 && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
            // Accept Connection Request (OCF 0x0009) - MAC at offset 3
            if (ocf === 0x0009 && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
            // Remote Name Request (OCF 0x0019) - MAC at offset 3
            if (ocf === 0x0019 && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
        }
        
        // LE Controller Commands (OGF 0x08)
        if (ogf === 0x08) {
            // LE Create Connection (OCF 0x000D) - MAC at offset 3
            if (ocf === 0x000D && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
            // LE Add Device to White List (OCF 0x0011) - MAC at offset 3
            if (ocf === 0x0011 && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
            // LE Remove Device from White List (OCF 0x0012) - MAC at offset 3
            if (ocf === 0x0012 && data.length >= 9 && isLikelyMAC(3)) {
                macs.push(formatMAC(3));
            }
        }
    }

    // Event packets (0x04)
    if (type === 0x04 && data.length >= 2) {
        const eventCode = data[1];
        
        // Connection Complete (0x03) - MAC at offset 5
        if (eventCode === 0x03 && data.length >= 11 && isLikelyMAC(5)) {
            macs.push(formatMAC(5));
        }
        // Connection Request (0x04) - MAC at offset 3
        if (eventCode === 0x04 && data.length >= 9 && isLikelyMAC(3)) {
            macs.push(formatMAC(3));
        }
        // Disconnection Complete (0x05) - no MAC
        // Remote Name Request Complete (0x07) - MAC at offset 4
        if (eventCode === 0x07 && data.length >= 10 && isLikelyMAC(4)) {
            macs.push(formatMAC(4));
        }
        // LE Connection Complete (0x3E) - MAC at offset 8
        if (eventCode === 0x3E && data.length >= 14 && isLikelyMAC(8)) {
            macs.push(formatMAC(8));
        }
        // LE Advertising Report (0x3C) - multiple MACs
        if (eventCode === 0x3C && data.length >= 3) {
            const numReports = data[2];
            let offset = 3;
            for (let i = 0; i < numReports && offset + 7 < data.length; i++) {
                const eventType = data[offset];
                const addressType = data[offset + 1];
                if (isLikelyMAC(offset + 2)) {
                    // Try both normal and reversed byte order
                    macs.push(formatMAC(offset + 2));
                    macs.push(formatMACReversed(offset + 2));
                }
                offset += 2 + 6 + data[offset + 8]; // Skip MAC + length
            }
        }
    }

    // ACL data packets (0x02) - MAC addresses are typically in connection handles, not in payload
    // Skip ACL data scanning to avoid false positives from protocol data

    return [...new Set(macs)]; // Remove duplicates
}

function getPacketType(data) {
    if (data.length === 0) return 'unknown';
    const type = data[0];
    switch (type) {
        case 0x01: return 'command';
        case 0x02: return 'acl';
        case 0x03: return 'sco';
        case 0x04: return 'event';
        default: return 'unknown (0x' + type.toString(16) + ')';
    }
}

function getPacketSummary(packet) {
    const data = packet.data;
    if (data.length === 0) return 'Empty';

    const type = data[0];
    let summary = '';

    switch (type) {
        case 0x01: // Command
            if (data.length >= 3) {
                const ogf = (data[1] >> 2) & 0x3F;
                const ocf = ((data[1] & 0x03) << 8) | data[2];
                summary = `OGF: 0x${ogf.toString(16).padStart(2, '0')}, OCF: 0x${ocf.toString(16).padStart(4, '0')}`;
            }
            break;
        case 0x04: // Event
            if (data.length >= 2) {
                summary = `Event Code: 0x${data[1].toString(16).padStart(2, '0')}`;
            }
            break;
        case 0x02: // ACL
            if (data.length >= 4) {
                const handle = data[1] | ((data[2] & 0x0F) << 8);
                const pb = (data[2] >> 4) & 0x03;
                const bc = (data[2] >> 6) & 0x03;
                summary = `Handle: ${handle}, PB: ${pb}, BC: ${bc}`;
            }
            break;
        case 0x03: // SCO
            if (data.length >= 3) {
                const handle = data[1] & 0x0FFF;
                summary = `Handle: ${handle}`;
            }
            break;
        default:
            summary = `Type: 0x${type.toString(16)}`;
    }

    return summary;
}

function displayPackets() {
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredPackets.length);
    const pagePackets = filteredPackets.slice(start, end);

    document.getElementById('packetCount').textContent = `Showing ${start + 1}-${end} of ${filteredPackets.length} packets`;

    packetBody.innerHTML = pagePackets.map((packet, i) => `
        <tr class="packet-row cursor-pointer" onclick="showPacketDetail(${start + i})">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${packet.index}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatTimestamp(packet.timestamp)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(packet.type)}">${packet.type}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${packet.direction}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${packet.includedLength}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${packet.macAddresses.length > 0 ? packet.macAddresses.join(', ') : '-'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${getPacketSummary(packet)}</td>
        </tr>
    `).join('');

    updatePagination();
}

function getTypeColor(type) {
    const colors = {
        'command': 'bg-blue-100 text-blue-800',
        'event': 'bg-green-100 text-green-800',
        'acl': 'bg-purple-100 text-purple-800',
        'sco': 'bg-yellow-100 text-yellow-800',
        'unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors['unknown'];
}

function updatePagination() {
    const totalPages = Math.ceil(filteredPackets.length / pageSize);
    const pagination = document.getElementById('pagination');
    
    let html = `
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
            class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}">Previous</button>
        <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
            class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}">Next</button>
    `;
    
    pagination.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredPackets.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    displayPackets();
}

function showPacketDetail(index) {
    const packet = filteredPackets[index];
    const hexData = Array.from(packet.data).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    detailContent.innerHTML = `
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div><strong>Index:</strong> ${packet.index}</div>
            <div><strong>Timestamp:</strong> ${formatTimestamp(packet.timestamp)}</div>
            <div><strong>Type:</strong> ${packet.type}</div>
            <div><strong>Direction:</strong> ${packet.direction}</div>
            <div><strong>Original Length:</strong> ${packet.originalLength}</div>
            <div><strong>Included Length:</strong> ${packet.includedLength}</div>
            <div><strong>Flags:</strong> 0x${packet.flags.toString(16).padStart(8, '0')}</div>
            <div><strong>Cumulative Drops:</strong> ${packet.cumulativeDrops}</div>
        </div>
        <div class="mb-4">
            <h3 class="font-semibold text-gray-800 mb-2">MAC Addresses</h3>
            <p class="text-gray-600">${packet.macAddresses.length > 0 ? packet.macAddresses.join(', ') : 'None found'}</p>
        </div>
        <div class="mb-4">
            <h3 class="font-semibold text-gray-800 mb-2">Summary</h3>
            <p class="text-gray-600">${getPacketSummary(packet)}</p>
        </div>
        <div>
            <h3 class="font-semibold text-gray-800 mb-2">Raw Data (Hex)</h3>
            <div class="bg-gray-50 rounded-md p-4 overflow-x-auto">
                <pre class="hex-display text-sm">${formatHexDump(packet.data)}</pre>
            </div>
        </div>
    `;
    
    packetDetail.classList.remove('hidden');
}

function formatHexDump(data) {
    let result = '';
    for (let i = 0; i < data.length; i += 16) {
        const offset = i.toString(16).padStart(8, '0');
        const hex = Array.from(data.slice(i, i + 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
        const ascii = Array.from(data.slice(i, i + 16))
            .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.')
            .join('');
        result += `${offset}  ${hex.padEnd(47)}  |${ascii}|\n`;
    }
    return result;
}

function applyFilters() {
    const typeFilter = document.getElementById('packetTypeFilter').value;
    const directionFilter = document.getElementById('directionFilter').value;
    const macFilter = document.getElementById('macFilter').value.toUpperCase().trim();
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

    filteredPackets = packets.filter(packet => {
        if (typeFilter !== 'all' && packet.type !== typeFilter) return false;
        if (directionFilter !== 'all' && packet.direction !== directionFilter) return false;
        if (macFilter) {
            // Normalize MAC filter (remove colons, spaces, etc.)
            const normalizedMAC = macFilter.replace(/[^A-F0-9]/g, '');
            const hasMAC = packet.macAddresses.some(mac => {
                const normalizedPacketMAC = mac.replace(/[^A-F0-9]/g, '');
                return normalizedPacketMAC.includes(normalizedMAC) || normalizedMAC.includes(normalizedPacketMAC);
            });
            if (!hasMAC) return false;
        }
        if (searchFilter) {
            const hexStr = Array.from(packet.data).map(b => b.toString(16).padStart(2, '0')).join(' ');
            if (!hexStr.includes(searchFilter)) return false;
        }
        return true;
    });

    currentPage = 1;
    displayPackets();
}

function resetFilters() {
    document.getElementById('packetTypeFilter').value = 'all';
    document.getElementById('directionFilter').value = 'all';
    document.getElementById('macFilter').value = '';
    document.getElementById('searchFilter').value = '';
    filteredPackets = [...packets];
    currentPage = 1;
    displayPackets();
}

function dataViewToUint16(data, offset) {
    return (data[offset] << 8) | data[offset + 1];
}

function dataViewToUint32(data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function dataViewToUint64(data, offset) {
    const high = dataViewToUint32(data, offset);
    const low = dataViewToUint32(data, offset + 4);
    return (BigInt(high) << 32n) | BigInt(low);
}

function formatTimestamp(timestamp) {
    // BTSnoop timestamp is in microseconds since Jan 1, 0 AD
    const microseconds = Number(timestamp);
    const seconds = microseconds / 1000000;
    const date = new Date((seconds - 62135596800) * 1000); // Adjust for Unix epoch
    return date.toISOString().replace('T', ' ').substr(0, 19);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
