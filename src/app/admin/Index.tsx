"use client";
import { Scanner, useDevices } from "@yudiel/react-qr-scanner";
import { useState } from "react";

const AdminIndex = () => {
  const devices = useDevices();
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(
    undefined
  );
  const [scannedData, setScannedData] = useState<string>("");

  const highlightCodeOnCanvas = (detectedCodes, ctx) => {
    detectedCodes.forEach((detectedCode) => {
      const { boundingBox, cornerPoints } = detectedCode;

      // Draw bounding box
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );

      // Draw corner points
      ctx.fillStyle = "#FF0000";
      cornerPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  return (
    <div className="min-h-[calc(100vh-40px)]">
      {" "}
      <div>
        <select onChange={(e) => setSelectedDevice(e.target.value)}>
          <option value="">Select a camera</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </select>
        <div
          className="w-[400px] h-[400px] "
          style={{ transform: "scaleX(-1)" }}
        >
          <Scanner
            onScan={(result) => {
              console.log(result);
              setScannedData(result[0].rawValue);
            }}
            allowMultiple={true}
            scanDelay={0}
            constraints={{
              deviceId: selectedDevice,
              aspectRatio: 1, // Square aspect ratio
              // Advanced constraints
              width: { exact: 400 },
              height: { exact: 400 },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminIndex;
