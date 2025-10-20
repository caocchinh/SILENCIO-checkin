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
      level={"Q"}
      imageSettings={{
        src: "/assets/logo-bg-colorised-modified-small.webp",
        x: undefined,
        y: undefined,
        height: 32,
        width: 32,
        opacity: 1,
        excavate: true,
      }}
    />
  );
}
