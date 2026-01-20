# WOL Sender - Wake-on-LAN Plugin for Steam Deck

A Decky Loader plugin that allows you to scan your local network, manage devices, and send Wake-on-LAN (WOL) packets to remotely wake up sleeping computers directly from your Steam Deck.

![Decky Plugin](https://img.shields.io/badge/decky-plugin-blue)
![License](https://img.shields.io/badge/license-BSD--3--Clause-green)

## Features

- 🔍 **Network Scanning**: Automatically scan your local network to discover devices
- 💾 **Device Management**: Save and manage multiple devices with their MAC and IP addresses
- 📡 **Wake-on-LAN**: Send magic packets to wake up sleeping devices remotely
- 🔄 **Status Checking**: Check if devices are online/awake
- 🎮 **Steam Deck Optimized**: Fully integrated with the Steam Deck UI

## Installation

### Via Decky Plugin Store (Recommended)
1. Open Decky Loader on your Steam Deck
2. Navigate to the Plugin Store
3. Search for "WOL Sender"
4. Click Install

### Manual Installation
1. Download the latest release
2. Extract to `/home/deck/homebrew/plugins/wol-sender/`
3. Restart Decky Loader

## Usage

### Adding Devices

#### Option 1: Network Scan
1. Open the WOL Sender plugin from the Quick Access menu
2. Click "Scan Network"
3. Wait for the scan to complete (this may take 30-60 seconds)
4. Select a device from the discovered list
5. Edit the name if desired and click "Save"

#### Option 2: Manual Entry
1. Open the WOL Sender plugin
2. Click "Add Device"
3. Enter the device name, MAC address, and IP address
4. Click "Save"

### Waking Up Devices

1. Open the WOL Sender plugin
2. Find the device you want to wake up in your device list
3. Click the "Wake" button (power icon)
4. A notification will confirm the WOL packet was sent

### Checking Device Status

1. Click the "Check" button next to any device
2. The status indicator will update:
   - 🟢 Green: Device is online
   - 🔴 Red: Device is offline
   - 🟠 Orange: Checking status

### Managing Devices

- **Edit**: Click the edit icon to modify device details
- **Delete**: Click the trash icon to remove a device
- **Refresh Status**: Click "Check" to update the device's online status

## Requirements

### Target Devices (Computers to Wake)
- Network card with Wake-on-LAN support
- Wake-on-LAN enabled in BIOS/UEFI
- Wake-on-LAN enabled in the operating system
- Connected via Ethernet (recommended) or WiFi with WOL support

### Steam Deck
- Decky Loader installed
- Connected to the same local network as target devices
- Root access enabled (for network scanning features)

## Network Scanning

The plugin uses multiple methods to scan your network:

1. **arp-scan** (most reliable) - Requires installation
2. **nmap** (fallback) - Requires installation
3. **ARP cache** (basic fallback) - Built-in

For best results, install arp-scan or nmap on your Steam Deck:

```bash
# Install arp-scan (recommended)
sudo pacman -S arp-scan

# Or install nmap
sudo pacman -S nmap
```

## Troubleshooting

### Device won't wake up
- Ensure Wake-on-LAN is enabled in the device's BIOS/UEFI
- Verify the device's network card supports WOL
- Check that the MAC address is correct
- Ensure both devices are on the same local network
- Try using an Ethernet connection instead of WiFi

### Network scan finds no devices
- Make sure your Steam Deck is connected to the network
- Install arp-scan or nmap for better scanning (see above)
- Some networks may block broadcast packets
- Try adding devices manually if scanning doesn't work

### Device status always shows offline
- Verify the IP address is correct
- Check if the device has a firewall blocking ping/ICMP
- The device may be configured not to respond to ping

## Privacy & Security

- All device information is stored locally on your Steam Deck
- No data is sent to external servers
- Wake-on-LAN packets use standard UDP broadcast (ports 7 and 9)
- Network scanning is only performed when explicitly requested

## Development

### Building from Source

#### Prerequisites
- Node.js v16.14+
- pnpm v9
- Python 3.x (for backend)

#### Build Steps
```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm run build
```

### Project Structure
```
wol-sender/
├── main.py           # Python backend with WOL functionality
├── src/
│   └── index.tsx     # React frontend UI
├── plugin.json       # Plugin metadata
└── package.json      # Node.js dependencies
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
- Uses [decky-frontend-lib](https://github.com/SteamDeckHomebrew/decky-frontend-lib)
- Inspired by the Steam Deck community

## Support

- Report issues on [GitHub Issues](https://github.com/mrelipardo/wolSender/issues)
- Join the discussion on [Decky Discord](https://deckbrew.xyz/discord)

---

**Note**: This plugin requires the `_root` flag as it needs elevated permissions for network scanning operations.
