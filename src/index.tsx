import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  Field,
  Focusable,
  staticClasses,
  DialogButton,
  showModal,
  ConfirmModal,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api"
import { useState, useEffect, FC } from "react";
import { FaPowerOff, FaPlus, FaTrash, FaEdit, FaSync, FaNetworkWired, FaCircle } from "react-icons/fa";

// Backend API calls
const getDevices = callable<[], Device[]>("get_devices");
const addDevice = callable<[name: string, mac: string, ip: string], boolean>("add_device");
const removeDevice = callable<[mac: string], boolean>("remove_device");
const updateDevice = callable<[oldMac: string, name: string, mac: string, ip: string], boolean>("update_device");
const sendWOL = callable<[mac: string], boolean>("send_wol");
const checkDeviceStatus = callable<[ip: string], boolean>("check_device_status");
const scanNetwork = callable<[], ScannedDevice[]>("scan_network");
const getAvailableScanningTools = callable<[], string[]>("get_available_scanning_tools");

interface Device {
  name: string;
  mac: string;
  ip: string;
}

interface ScannedDevice {
  ip: string;
  mac: string;
  hostname: string;
}

interface DeviceWithStatus extends Device {
  isOnline?: boolean;
  checking?: boolean;
}

// Add/Edit Device Modal
const DeviceModal: FC<{
  device?: Device;
  onSave: (name: string, mac: string, ip: string) => Promise<void>;
  closeModal?: () => void;
}> = ({ device, onSave, closeModal }) => {
  const [name, setName] = useState(device?.name || "");
  const [mac, setMac] = useState(device?.mac || "");
  const [ip, setIp] = useState(device?.ip || "");
  const [saving, setSaving] = useState(false);
  const [macError, setMacError] = useState("");
  const [ipError, setIpError] = useState("");

  // Validate MAC address format
  const validateMAC = (macAddress: string) => {
    if (!macAddress) {
      setMacError("");
      return false;
    }
    
    // MAC format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      setMacError("Invalid MAC format. Use AA:BB:CC:DD:EE:FF");
      return false;
    }
    
    setMacError("");
    return true;
  };

  // Validate IP address format
  const validateIP = (ipAddress: string) => {
    if (!ipAddress) {
      setIpError("");
      return false;
    }
    
    // Basic IPv4 format check
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      setIpError("Invalid IP format. Use 192.168.1.100");
      return false;
    }
    
    // Validate each octet
    const octets = ipAddress.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        setIpError("IP octets must be between 0 and 255");
        return false;
      }
    }
    
    setIpError("");
    return true;
  };

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMac(value);
    if (value) validateMAC(value);
  };

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIp(value);
    if (value) validateIP(value);
  };

  const handleSave = async () => {
    if (!name || !mac || !ip) {
      toaster.toast({
        title: "Validation Error",
        body: "All fields are required"
      });
      return;
    }

    // Validate before saving
    const isMacValid = validateMAC(mac);
    const isIpValid = validateIP(ip);
    
    if (!isMacValid || !isIpValid) {
      toaster.toast({
        title: "Validation Error",
        body: "Please fix the errors before saving"
      });
      return;
    }

    setSaving(true);
    try {
      await onSave(name, mac, ip);
      closeModal?.();
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: "Failed to save device"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Focusable style={{ 
      minWidth: "400px", 
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }}>
      <div style={{ fontSize: "1.5em", marginBottom: "10px" }}>
        {device ? "Edit Device" : "Add Device Manually"}
      </div>
      
      {!device && (
        <div style={{ 
          fontSize: "0.9em", 
          opacity: 0.7, 
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "5px"
        }}>
          💡 Manual entry is useful when network scanning doesn't find your device or scanning tools aren't available.
        </div>
      )}
      
      <TextField
        label="Device Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Computer"
      />
      
      <div>
        <TextField
          label="MAC Address"
          value={mac}
          onChange={handleMacChange}
          placeholder="AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF"
        />
        {macError && (
          <div style={{ 
            color: "#ff6b6b", 
            fontSize: "0.85em", 
            marginTop: "5px" 
          }}>
            ⚠️ {macError}
          </div>
        )}
      </div>
      
      <div>
        <TextField
          label="IP Address"
          value={ip}
          onChange={handleIpChange}
          placeholder="192.168.1.100"
        />
        {ipError && (
          <div style={{ 
            color: "#ff6b6b", 
            fontSize: "0.85em", 
            marginTop: "5px" 
          }}>
            ⚠️ {ipError}
          </div>
        )}
      </div>

      <div style={{ 
        display: "flex", 
        gap: "10px", 
        marginTop: "20px",
        justifyContent: "flex-end"
      }}>
        <DialogButton onClick={closeModal} disabled={saving}>
          Cancel
        </DialogButton>
        <DialogButton onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </DialogButton>
      </div>
    </Focusable>
  );
};

// Network Scan Modal
const NetworkScanModal: FC<{
  onDeviceSelect: (device: ScannedDevice) => void;
  closeModal?: () => void;
}> = ({ onDeviceSelect, closeModal }) => {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [scanAttempted, setScanAttempted] = useState(false);

  const loadAvailableTools = async () => {
    try {
      const tools = await getAvailableScanningTools();
      setAvailableTools(tools);
    } catch (error) {
      console.error("Failed to get available scanning tools:", error);
    }
  };

  const performScan = async () => {
    setScanning(true);
    setScanAttempted(true);
    try {
      const result = await scanNetwork();
      setDevices(result);
      if (result.length === 0) {
        toaster.toast({
          title: "No Devices Found",
          body: "Try adding a device manually or check your network connection."
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Scan Error",
        body: "Failed to scan network. Consider manual device entry."
      });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadAvailableTools();
    performScan();
  }, []);

  return (
    <Focusable style={{ 
      minWidth: "500px",
      maxHeight: "600px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }}>
      <div style={{ 
        fontSize: "1.5em", 
        marginBottom: "10px",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        Network Scan
        <DialogButton 
          onClick={performScan} 
          disabled={scanning}
          style={{ marginLeft: "auto" }}
        >
          <FaSync /> {scanning ? "Scanning..." : "Rescan"}
        </DialogButton>
      </div>

      {/* Show available tools info */}
      {availableTools.length > 0 && (
        <div style={{ 
          fontSize: "0.85em", 
          opacity: 0.7,
          padding: "8px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "5px"
        }}>
          📡 Available methods: {availableTools.join(", ")}
        </div>
      )}

      {scanning && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          Scanning network...
        </div>
      )}

      {!scanning && scanAttempted && devices.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          padding: "20px",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "5px"
        }}>
          <div style={{ fontSize: "1.2em", marginBottom: "10px" }}>
            No devices found
          </div>
          <div style={{ fontSize: "0.9em", opacity: 0.8, marginBottom: "15px" }}>
            {availableTools.length === 0 
              ? "⚠️ No scanning tools available. Install arp-scan, nmap, or ensure ping is available."
              : "Make sure you're connected to a network and devices are powered on."}
          </div>
          <div style={{ fontSize: "0.9em", opacity: 0.7 }}>
            💡 Try using "Add Device Manually" instead to enter device details directly.
          </div>
        </div>
      )}

      <div style={{ 
        overflowY: "auto",
        flex: 1
      }}>
        {devices.map((device, index) => (
          <div 
            key={index}
            style={{
              padding: "10px",
              marginBottom: "5px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "5px",
              cursor: "pointer"
            }}
            onClick={() => {
              onDeviceSelect(device);
              closeModal?.();
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              {device.hostname || "Unknown Device"}
            </div>
            <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
              IP: {device.ip}
            </div>
            <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
              MAC: {device.mac}
            </div>
          </div>
        ))}
      </div>

      <DialogButton onClick={closeModal} style={{ marginTop: "10px" }}>
        Close
      </DialogButton>
    </Focusable>
  );
};

// Device Item Component
const DeviceItem: FC<{
  device: DeviceWithStatus;
  onWake: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCheckStatus: () => void;
}> = ({ device, onWake, onEdit, onDelete, onCheckStatus }) => {
  return (
    <PanelSectionRow>
      <Field
        label={
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            width: "100%" 
          }}>
            <FaCircle 
              size={10}
              color={device.checking ? "#FFA500" : device.isOnline ? "#00FF00" : "#FF0000"} 
            />
            <span style={{ flex: 1 }}>{device.name}</span>
          </div>
        }
        description={
          <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
            <div>IP: {device.ip}</div>
            <div>MAC: {device.mac}</div>
          </div>
        }
      >
        <Focusable style={{ 
          display: "flex", 
          gap: "5px",
          marginTop: "10px" 
        }}>
          <DialogButton 
            onClick={onWake}
            style={{ 
              minWidth: "auto",
              padding: "5px 10px"
            }}
          >
            <FaPowerOff /> Wake
          </DialogButton>
          <DialogButton 
            onClick={onCheckStatus}
            disabled={device.checking}
            style={{ 
              minWidth: "auto",
              padding: "5px 10px"
            }}
          >
            <FaSync /> {device.checking ? "..." : "Check"}
          </DialogButton>
          <DialogButton 
            onClick={onEdit}
            style={{ 
              minWidth: "auto",
              padding: "5px 10px"
            }}
          >
            <FaEdit />
          </DialogButton>
          <DialogButton 
            onClick={onDelete}
            style={{ 
              minWidth: "auto",
              padding: "5px 10px"
            }}
          >
            <FaTrash />
          </DialogButton>
        </Focusable>
      </Field>
    </PanelSectionRow>
  );
};

// Main Content Component
function Content() {
  const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    try {
      const result = await getDevices();
      setDevices(result.map(d => ({ ...d, isOnline: undefined, checking: false })));
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: "Failed to load devices"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleWake = async (device: Device) => {
    try {
      const success = await sendWOL(device.mac);
      if (success) {
        toaster.toast({
          title: "WOL Sent",
          body: `Wake-on-LAN packet sent to ${device.name}`
        });
      } else {
        toaster.toast({
          title: "Error",
          body: `Failed to send WOL packet to ${device.name}`
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Error",
        body: "Failed to send WOL packet"
      });
    }
  };

  const handleCheckStatus = async (device: DeviceWithStatus, index: number) => {
    setDevices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checking: true };
      return updated;
    });

    try {
      const isOnline = await checkDeviceStatus(device.ip);
      setDevices(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isOnline, checking: false };
        return updated;
      });
    } catch (error) {
      setDevices(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], checking: false };
        return updated;
      });
    }
  };

  const handleAddDevice = () => {
    showModal(
      <DeviceModal
        onSave={async (name, mac, ip) => {
          const success = await addDevice(name, mac, ip);
          if (success) {
            toaster.toast({
              title: "Device Added",
              body: `${name} has been added`
            });
            await loadDevices();
          } else {
            throw new Error("Failed to add device");
          }
        }}
      />
    );
  };

  const handleEditDevice = (device: Device) => {
    showModal(
      <DeviceModal
        device={device}
        onSave={async (name, mac, ip) => {
          const success = await updateDevice(device.mac, name, mac, ip);
          if (success) {
            toaster.toast({
              title: "Device Updated",
              body: `${name} has been updated`
            });
            await loadDevices();
          } else {
            throw new Error("Failed to update device");
          }
        }}
      />
    );
  };

  const handleDeleteDevice = (device: Device) => {
    showModal(
      <ConfirmModal
        strTitle="Delete Device"
        strDescription={`Are you sure you want to delete ${device.name}?`}
        onOK={async () => {
          const success = await removeDevice(device.mac);
          if (success) {
            toaster.toast({
              title: "Device Deleted",
              body: `${device.name} has been deleted`
            });
            await loadDevices();
          } else {
            toaster.toast({
              title: "Error",
              body: "Failed to delete device"
            });
          }
        }}
      />
    );
  };

  const handleNetworkScan = () => {
    showModal(
      <NetworkScanModal
        onDeviceSelect={(scannedDevice) => {
          showModal(
            <DeviceModal
              device={{
                name: scannedDevice.hostname || "Unknown Device",
                mac: scannedDevice.mac,
                ip: scannedDevice.ip
              }}
              onSave={async (name, mac, ip) => {
                const success = await addDevice(name, mac, ip);
                if (success) {
                  toaster.toast({
                    title: "Device Added",
                    body: `${name} has been added`
                  });
                  await loadDevices();
                } else {
                  throw new Error("Failed to add device");
                }
              }}
            />
          );
        }}
      />
    );
  };

  return (
    <PanelSection title="Wake-on-LAN">
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleAddDevice}
        >
          <FaPlus /> Add Device Manually
        </ButtonItem>
      </PanelSectionRow>
      
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={handleNetworkScan}
        >
          <FaNetworkWired /> Scan Network
        </ButtonItem>
      </PanelSectionRow>

      {loading && (
        <PanelSectionRow>
          <div style={{ textAlign: "center" }}>Loading devices...</div>
        </PanelSectionRow>
      )}

      {!loading && devices.length === 0 && (
        <PanelSectionRow>
          <div style={{ textAlign: "center", opacity: 0.6 }}>
            No devices added yet. Click "Add Device Manually" to enter device details or "Scan Network" to discover devices.
          </div>
        </PanelSectionRow>
      )}

      {!loading && devices.map((device, index) => (
        <DeviceItem
          key={device.mac}
          device={device}
          onWake={() => handleWake(device)}
          onEdit={() => handleEditDevice(device)}
          onDelete={() => handleDeleteDevice(device)}
          onCheckStatus={() => handleCheckStatus(device, index)}
        />
      ))}
    </PanelSection>
  );
}

export default definePlugin(() => {
  console.log("WOL Sender plugin initializing");

  return {
    name: "WOL Sender",
    titleView: <div className={staticClasses.Title}>Wake-on-LAN Sender</div>,
    content: <Content />,
    icon: <FaPowerOff />,
    onDismount() {
      console.log("WOL Sender plugin unloading");
    },
  };
});
