"use client";

import { QRCodeCanvas } from "qrcode.react";

export default function QR({ url }: { url: string }) {
  return (
    <QRCodeCanvas
      className="rounded-md w-full h-full min-h-[215px] min-w-[215px]"
      value={url}
      title={"Silencio"}
      size={215}
      marginSize={2}
      bgColor={"#ffffff"}
      fgColor={"#000000"}
      level={"H"}
      imageSettings={{
        src: "/assets/logo.webp",
        x: undefined,
        y: undefined,
        height: 35,
        width: 35,
        opacity: 1,
        excavate: true,
      }}
    />
  );
}
