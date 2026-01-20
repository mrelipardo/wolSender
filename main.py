import os
import socket
import struct
import subprocess
import json
from typing import List, Dict, Optional
import asyncio
import ipaddress

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky

class Plugin:
    """Wake-on-LAN plugin for Steam Deck."""
    
    async def _main(self):
        """Initialize the plugin."""
        self.loop = asyncio.get_event_loop()
        self.settings_file = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "devices.json")
        decky.logger.info("WOL Sender plugin initialized")
        
        # Ensure settings directory exists
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)

    async def _unload(self):
        """Handle plugin unload."""
        decky.logger.info("WOL Sender plugin unloading")

    async def _uninstall(self):
        """Handle plugin uninstall."""
        decky.logger.info("WOL Sender plugin uninstalled")

    async def _migration(self):
        """Handle any necessary migrations."""
        decky.logger.info("WOL Sender plugin migration")

    # Device Management Methods
    
    def _normalize_and_validate_mac(self, mac: str) -> Optional[str]:
        """Normalize and validate MAC address format."""
        try:
            # Clean and validate MAC address
            mac = mac.upper().replace('-', ':')
            mac_parts = mac.split(':')
            
            if len(mac_parts) != 6:
                return None
            
            # Validate each part is 2 hex characters
            for part in mac_parts:
                if len(part) != 2:
                    return None
                try:
                    int(part, 16)
                except ValueError:
                    return None
            
            return mac
        except Exception:
            return None

    async def get_devices(self) -> List[Dict[str, str]]:
        """Get the list of saved devices."""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r') as f:
                    return json.load(f)
            return []
        except Exception as e:
            decky.logger.error(f"Error loading devices: {e}")
            return []

    async def save_devices(self, devices: List[Dict[str, str]]) -> bool:
        """Save the list of devices."""
        try:
            with open(self.settings_file, 'w') as f:
                json.dump(devices, f, indent=2)
            return True
        except Exception as e:
            decky.logger.error(f"Error saving devices: {e}")
            return False

    async def add_device(self, name: str, mac: str, ip: str) -> bool:
        """Add a new device to the list."""
        try:
            devices = await self.get_devices()
            
            # Validate and normalize MAC address
            normalized_mac = self._normalize_and_validate_mac(mac)
            if not normalized_mac:
                decky.logger.error(f"Invalid MAC address format: {mac}")
                return False
            
            # Validate IP address format
            if not self._is_valid_ip(ip):
                decky.logger.error(f"Invalid IP address format: {ip}")
                return False
            
            # Check if device already exists
            for device in devices:
                if device['mac'] == normalized_mac:
                    decky.logger.warning(f"Device with MAC {normalized_mac} already exists")
                    return False
            
            devices.append({
                'name': name,
                'mac': normalized_mac,
                'ip': ip
            })
            
            return await self.save_devices(devices)
        except Exception as e:
            decky.logger.error(f"Error adding device: {e}")
            return False

    async def remove_device(self, mac: str) -> bool:
        """Remove a device from the list."""
        try:
            devices = await self.get_devices()
            normalized_mac = self._normalize_and_validate_mac(mac)
            if not normalized_mac:
                decky.logger.error(f"Invalid MAC address format: {mac}")
                return False
            
            devices = [d for d in devices if d['mac'] != normalized_mac]
            return await self.save_devices(devices)
        except Exception as e:
            decky.logger.error(f"Error removing device: {e}")
            return False

    async def update_device(self, old_mac: str, name: str, mac: str, ip: str) -> bool:
        """Update an existing device."""
        try:
            devices = await self.get_devices()
            
            # Validate and normalize MAC addresses
            old_mac_normalized = self._normalize_and_validate_mac(old_mac)
            new_mac_normalized = self._normalize_and_validate_mac(mac)
            
            if not old_mac_normalized or not new_mac_normalized:
                decky.logger.error("Invalid MAC address format")
                return False
            
            # Validate IP address
            if not self._is_valid_ip(ip):
                decky.logger.error(f"Invalid IP address format: {ip}")
                return False
            
            for device in devices:
                if device['mac'] == old_mac_normalized:
                    device['name'] = name
                    device['mac'] = new_mac_normalized
                    device['ip'] = ip
                    return await self.save_devices(devices)
            
            decky.logger.warning(f"Device with MAC {old_mac_normalized} not found")
            return False
        except Exception as e:
            decky.logger.error(f"Error updating device: {e}")
            return False

    # Wake-on-LAN Methods
    
    async def send_wol(self, mac: str) -> bool:
        """Send a Wake-on-LAN magic packet to the specified MAC address."""
        try:
            # Validate and normalize MAC address
            normalized_mac = self._normalize_and_validate_mac(mac)
            if not normalized_mac:
                decky.logger.error(f"Invalid MAC address: {mac}")
                return False
            
            # Convert MAC address to bytes
            mac_bytes = bytes.fromhex(normalized_mac.replace(':', ''))
            
            # Create magic packet (6 bytes of FF followed by 16 repetitions of MAC)
            magic_packet = b'\xff' * 6 + mac_bytes * 16
            
            # Send packet via broadcast
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            # Send to multiple broadcast addresses to increase reliability
            broadcast_addresses = [
                ('255.255.255.255', 9),
                ('255.255.255.255', 7),
            ]
            
            for addr, port in broadcast_addresses:
                sock.sendto(magic_packet, (addr, port))
            
            sock.close()
            
            decky.logger.info(f"WOL packet sent to {normalized_mac}")
            return True
            
        except Exception as e:
            decky.logger.error(f"Error sending WOL packet: {e}")
            return False

    # Network Scanning Methods
    
    async def check_device_status(self, ip: str) -> bool:
        """Check if a device is awake by pinging it."""
        try:
            # Validate IP address format to prevent command injection
            if not self._is_valid_ip(ip):
                decky.logger.error(f"Invalid IP address format: {ip}")
                return False
            
            # Use ping command with timeout
            result = subprocess.run(
                ['ping', '-c', '1', '-W', '1', ip],
                capture_output=True,
                timeout=2
            )
            return result.returncode == 0
        except Exception as e:
            decky.logger.error(f"Error checking device status: {e}")
            return False

    async def get_local_network_info(self) -> Optional[Dict[str, str]]:
        """Get local network information (IP and subnet)."""
        try:
            # Get default interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            
            # Get subnet mask using ip command
            result = subprocess.run(
                ['ip', 'addr', 'show'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if local_ip in line and 'inet ' in line:
                        # Extract CIDR notation
                        parts = line.strip().split()
                        for part in parts:
                            if '/' in part and local_ip in part:
                                return {
                                    'ip': local_ip,
                                    'cidr': part
                                }
            
            # Fallback to /24 network
            return {
                'ip': local_ip,
                'cidr': f"{local_ip}/24"
            }
            
        except Exception as e:
            decky.logger.error(f"Error getting network info: {e}")
            return None

    async def scan_network(self) -> List[Dict[str, str]]:
        """Scan the local network for active devices."""
        try:
            network_info = await self.get_local_network_info()
            if not network_info:
                decky.logger.error("Could not determine local network")
                return []
            
            decky.logger.info(f"Scanning network: {network_info['cidr']}")
            
            # Use arp-scan if available, otherwise fall back to nmap or manual ping sweep
            devices = []
            
            # Try arp-scan first (most reliable for MAC addresses)
            try:
                result = subprocess.run(
                    ['arp-scan', '--localnet', '--plain'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        parts = line.strip().split('\t')
                        if len(parts) >= 2:
                            ip = parts[0]
                            mac = parts[1].upper()
                            if self._is_valid_ip(ip) and self._is_valid_mac(mac):
                                devices.append({
                                    'ip': ip,
                                    'mac': mac,
                                    'hostname': await self._get_hostname(ip)
                                })
                    
                    if devices:
                        return devices
            except FileNotFoundError:
                decky.logger.info("arp-scan not available, trying nmap")
            except Exception as e:
                decky.logger.warning(f"arp-scan failed: {e}")
            
            # Try nmap as fallback
            try:
                result = subprocess.run(
                    ['nmap', '-sn', network_info['cidr']],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    # Parse nmap output and get MAC addresses from ARP cache
                    await self._parse_nmap_output(result.stdout, devices)
                    if devices:
                        return devices
            except FileNotFoundError:
                decky.logger.info("nmap not available, using manual scan")
            except Exception as e:
                decky.logger.warning(f"nmap failed: {e}")
            
            # Fallback to ARP cache only
            return await self._scan_arp_cache()
            
        except Exception as e:
            decky.logger.error(f"Error scanning network: {e}")
            return []

    def _is_valid_ip(self, ip: str) -> bool:
        """Check if IP address is valid."""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    def _is_valid_mac(self, mac: str) -> bool:
        """Check if MAC address is valid."""
        mac_parts = mac.replace('-', ':').split(':')
        return len(mac_parts) == 6 and all(len(p) == 2 for p in mac_parts)

    async def _get_hostname(self, ip: str) -> str:
        """Try to resolve hostname for IP address."""
        try:
            result = subprocess.run(
                ['nslookup', ip],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'name =' in line.lower():
                        return line.split('=')[1].strip().rstrip('.')
        except:
            pass
        
        return ""

    async def _parse_nmap_output(self, output: str, devices: List[Dict[str, str]]):
        """Parse nmap output to find devices."""
        current_ip = None
        
        for line in output.split('\n'):
            if 'Nmap scan report for' in line:
                parts = line.split()
                current_ip = parts[-1].strip('()')
            elif 'MAC Address:' in line and current_ip:
                parts = line.split()
                mac_index = parts.index('Address:') + 1
                mac = parts[mac_index].upper()
                
                if self._is_valid_mac(mac):
                    devices.append({
                        'ip': current_ip,
                        'mac': mac,
                        'hostname': await self._get_hostname(current_ip)
                    })
                current_ip = None

    async def _scan_arp_cache(self) -> List[Dict[str, str]]:
        """Scan ARP cache for devices."""
        devices = []
        
        try:
            # Read ARP cache
            result = subprocess.run(
                ['ip', 'neigh', 'show'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    parts = line.split()
                    if len(parts) >= 5 and 'lladdr' in parts:
                        ip = parts[0]
                        mac_index = parts.index('lladdr') + 1
                        if mac_index < len(parts):
                            mac = parts[mac_index].upper()
                            
                            if self._is_valid_ip(ip) and self._is_valid_mac(mac):
                                devices.append({
                                    'ip': ip,
                                    'mac': mac,
                                    'hostname': await self._get_hostname(ip)
                                })
            
            return devices
            
        except Exception as e:
            decky.logger.error(f"Error reading ARP cache: {e}")
            return []
