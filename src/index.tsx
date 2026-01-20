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

  const handleSave = async () => {
    if (!name || !mac || !ip) {
      toaster.toast({
        title: "Validation Error",
        body: "All fields are required"
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
        {device ? "Edit Device" : "Add Device"}
      </div>
      
      <TextField
        label="Device Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Computer"
      />
      
      <TextField
        label="MAC Address"
        value={mac}
        onChange={(e) => setMac(e.target.value)}
        placeholder="AA:BB:CC:DD:EE:FF"
      />
      
      <TextField
        label="IP Address"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        placeholder="192.168.1.100"
      />

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

  const performScan = async () => {
    setScanning(true);
    try {
      const result = await scanNetwork();
      setDevices(result);
      if (result.length === 0) {
        toaster.toast({
          title: "No Devices Found",
          body: "No devices found on the network. Make sure you're connected to a network."
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Scan Error",
        body: "Failed to scan network"
      });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
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

      {scanning && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          Scanning network...
        </div>
      )}

      {!scanning && devices.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          No devices found
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
        <Focusable style={{ display: "flex", gap: "10px" }}>
          <ButtonItem
            layout="below"
            onClick={handleAddDevice}
          >
            <FaPlus /> Add Device
          </ButtonItem>
          <ButtonItem
            layout="below"
            onClick={handleNetworkScan}
          >
            <FaNetworkWired /> Scan Network
          </ButtonItem>
        </Focusable>
      </PanelSectionRow>

      {loading && (
        <PanelSectionRow>
          <div style={{ textAlign: "center" }}>Loading devices...</div>
        </PanelSectionRow>
      )}

      {!loading && devices.length === 0 && (
        <PanelSectionRow>
          <div style={{ textAlign: "center", opacity: 0.6 }}>
            No devices added yet. Click "Add Device" or "Scan Network" to get started.
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
