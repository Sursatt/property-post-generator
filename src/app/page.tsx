"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useMemo, useState } from "react";
import JSZip from "jszip";

type RatioKey = "1:1" | "4:5" | "9:16";
type FitMode = "smart" | "fit" | "fill";

type ImageItem = {
  id: string;
  name: string;
  url: string;
};

const imageSizes: Record<
  RatioKey,
  { width: number; height: number; label: string }
> = {
  "1:1": {
    width: 1080,
    height: 1080,
    label: "1080 × 1080",
  },
  "4:5": {
    width: 1080,
    height: 1350,
    label: "1080 × 1350",
  },
  "9:16": {
    width: 1080,
    height: 1920,
    label: "1080 × 1920",
  },
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "image";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    image.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const frameRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceW = image.width;
  let sourceH = image.height;

  if (imageRatio > frameRatio) {
    sourceW = image.height * frameRatio;
    sourceX = (image.width - sourceW) / 2;
  } else {
    sourceH = image.width / frameRatio;
    sourceY = (image.height - sourceH) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, width, height);
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const frameRatio = width / height;

  let drawW = 0;
  let drawH = 0;

  if (imageRatio > frameRatio) {
    drawW = width;
    drawH = width / imageRatio;
  } else {
    drawH = height;
    drawW = height * imageRatio;
  }

  const drawX = x + (width - drawW) / 2;
  const drawY = y + (height - drawH) / 2;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

async function createPostImageBlob(
  imageUrl: string,
  width: number,
  height: number,
  mode: FitMode
): Promise<Blob> {
  const image = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas ใช้งานไม่ได้");
  }

  // พื้นหลังเต็ม canvas ไม่มีขอบ
  ctx.fillStyle = "#f4f4f1";
  ctx.fillRect(0, 0, width, height);

  if (mode === "fill") {
    // เต็มเฟรม ไม่มีขอบ แต่ครอปบางส่วน
    drawImageCover(ctx, image, 0, 0, width, height);
  }

  if (mode === "fit") {
    // เห็นรูปเต็ม ไม่ครอป แต่มีพื้นที่ว่างถ้าสัดส่วนไม่ตรง
    ctx.fillStyle = "#f4f4f1";
    ctx.fillRect(0, 0, width, height);
    drawImageContain(ctx, image, 0, 0, width, height);
  }

  if (mode === "smart") {
    // AI Fill แบบ Smart Background:
    // พื้นหลังใช้รูปเดิมขยายเต็มเฟรม + เบลอ
    ctx.save();
    ctx.filter = "blur(34px)";
    drawImageCover(ctx, image, -90, -90, width + 180, height + 180);
    ctx.restore();

    // overlay ให้พื้นหลังนิ่งขึ้น
    ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
    ctx.fillRect(0, 0, width, height);

    // รูปจริงอยู่ด้านหน้าแบบเห็นครบ ไม่ครอป ไม่มีกรอบขาว
    drawImageContain(ctx, image, 0, 0, width, height);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("สร้าง PNG ไม่สำเร็จ"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function getModeLabel(mode: FitMode) {
  if (mode === "smart") return "AI Fill";
  if (mode === "fit") return "Fit";
  return "Fill";
}

function getModeText(mode: FitMode) {
  if (mode === "smart") {
    return "AI Fill = เต็มกรอบด้วยพื้นหลังเบลอ และเห็นรูปจริงครบ";
  }

  if (mode === "fit") {
    return "Fit = เห็นรูปเต็ม ไม่ครอป แต่อาจมีพื้นที่ว่าง";
  }

  return "Fill = เต็มกรอบ ไม่มีขอบ แต่อาจครอปบางส่วน";
}

export default function Home() {
  const [ratio, setRatio] = useState<RatioKey>("9:16");
  const [fitMode, setFitMode] = useState<FitMode>("smart");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isExportingAll, setIsExportingAll] = useState(false);

  const selectedSize = imageSizes[ratio];

  const previewClass = useMemo(() => {
    if (ratio === "9:16") return "aspect-[9/16]";
    if (ratio === "4:5") return "aspect-[4/5]";
    return "aspect-square";
  }, [ratio]);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const newImages: ImageItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
    event.target.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);

      if (target) {
        URL.revokeObjectURL(target.url);
      }

      return prev.filter((item) => item.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((item) => URL.revokeObjectURL(item.url));
    setImages([]);
  };

  const exportOne = async (item: ImageItem) => {
    try {
      const blob = await createPostImageBlob(
        item.url,
        selectedSize.width,
        selectedSize.height,
        fitMode
      );

      downloadBlob(
        blob,
        `${safeFileName(item.name)}-${ratio.replace(":", "x")}-${fitMode}.png`
      );
    } catch (error) {
      console.error(error);
      alert("Export รูปนี้ไม่สำเร็จ");
    }
  };

  const exportAll = async () => {
    if (!images.length) {
      alert("กรุณาอัปโหลดรูปก่อน");
      return;
    }

    try {
      setIsExportingAll(true);

      const zip = new JSZip();

      for (let i = 0; i < images.length; i++) {
        const item = images[i];

        const blob = await createPostImageBlob(
          item.url,
          selectedSize.width,
          selectedSize.height,
          fitMode
        );

        zip.file(
          `${String(i + 1).padStart(2, "0")}-${safeFileName(
            item.name
          )}-${ratio.replace(":", "x")}-${fitMode}.png`,
          blob
        );
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      downloadBlob(
        zipBlob,
        `real-estate-images-${ratio.replace(":", "x")}-${fitMode}.zip`
      );
    } catch (error) {
      console.error(error);
      alert("Export ทั้งหมดไม่สำเร็จ");
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f4f1] px-6 py-8 text-black">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-sm font-black uppercase tracking-[0.25em] text-[#173f32]">
              Bulk Image Post Maker
            </p>

            <h1 className="text-4xl font-black tracking-[-0.04em]">
              โปรแกรมทำภาพหลายรูป
            </h1>

            <p className="mt-2 text-black/60">
              อัปโหลดหลายรูป เลือกขนาด เลือก AI Fill / Fit / Fill แล้ว Export
              เป็น PNG
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportAll}
              disabled={!images.length || isExportingAll}
              className="rounded-full bg-[#173f32] px-7 py-4 font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExportingAll ? "กำลัง Export..." : "Export All ZIP"}
            </button>

            <button
              onClick={clearAll}
              disabled={!images.length}
              className="rounded-full border border-black/15 bg-white px-7 py-4 font-bold text-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ลบทั้งหมด
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-2xl font-black">ตั้งค่า</h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block font-bold">
                  อัปโหลดรูปหลายรูป
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  className="w-full rounded-2xl border border-black/20 p-3"
                />

                <p className="mt-2 text-sm text-black/50">
                  เลือกหลายรูปพร้อมกันได้
                </p>
              </div>

              <div>
                <p className="mb-2 font-bold">เลือกขนาดภาพ</p>

                <div className="grid gap-2">
                  {(Object.keys(imageSizes) as RatioKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRatio(key)}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        ratio === key
                          ? "border-[#173f32] bg-[#173f32] text-white"
                          : "border-black/15 bg-[#f7f7f4] text-black"
                      }`}
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-black">{key}</span>
                        <span className="text-sm opacity-70">
                          {imageSizes[key].label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-bold">โหมดการปรับรูป</p>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setFitMode("smart")}
                    className={`rounded-2xl border px-4 py-4 text-left ${
                      fitMode === "smart"
                        ? "border-[#173f32] bg-[#173f32] text-white"
                        : "border-black/15 bg-[#f7f7f4] text-black"
                    }`}
                  >
                    <p className="font-black">AI Fill</p>
                    <p className="mt-1 text-xs opacity-70">
                      เต็มกรอบ + เห็นรูปครบ
                    </p>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFitMode("fit")}
                      className={`rounded-2xl border px-4 py-4 text-left ${
                        fitMode === "fit"
                          ? "border-[#173f32] bg-[#173f32] text-white"
                          : "border-black/15 bg-[#f7f7f4] text-black"
                      }`}
                    >
                      <p className="font-black">Fit</p>
                      <p className="mt-1 text-xs opacity-70">เห็นรูปเต็ม</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFitMode("fill")}
                      className={`rounded-2xl border px-4 py-4 text-left ${
                        fitMode === "fill"
                          ? "border-[#173f32] bg-[#173f32] text-white"
                          : "border-black/15 bg-[#f7f7f4] text-black"
                      }`}
                    >
                      <p className="font-black">Fill</p>
                      <p className="mt-1 text-xs opacity-70">เต็มกรอบ</p>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f7f7f4] p-4 text-sm text-black/60">
                <p className="font-bold text-black">ขนาดที่เลือก</p>
                <p className="mt-1">
                  {selectedSize.width} × {selectedSize.height}px
                </p>

                <p className="mt-3 font-bold text-black">
                  โหมดตอนนี้: {getModeLabel(fitMode)}
                </p>

                <p className="mt-1">{getModeText(fitMode)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Preview</h2>
                <p className="text-black/50">
                  จำนวนรูปทั้งหมด {images.length} รูป
                </p>
              </div>

              <div className="rounded-full bg-[#f4f4f1] px-4 py-2 text-sm font-bold text-black/60">
                {ratio} / {getModeLabel(fitMode).toUpperCase()}
              </div>
            </div>

            {images.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] bg-[#e8e8e1] p-8 text-center">
                <div>
                  <p className="text-2xl font-black">ยังไม่มีรูป</p>
                  <p className="mt-2 text-black/55">
                    อัปโหลดรูปทางด้านซ้ายเพื่อเริ่มทำภาพ
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {images.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-black/10 bg-[#f7f7f4] p-4"
                  >
                    <div className="mb-3">
                      <p className="truncate font-bold">
                        {index + 1}. {item.name}
                      </p>
                      <p className="text-sm text-black/50">
                        {selectedSize.width} × {selectedSize.height}px ·{" "}
                        {getModeLabel(fitMode)}
                      </p>
                    </div>

                    <PreviewImage
                      imageUrl={item.url}
                      name={item.name}
                      previewClass={previewClass}
                      fitMode={fitMode}
                    />

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => exportOne(item)}
                        className="flex-1 rounded-2xl bg-[#173f32] px-4 py-3 font-bold text-white hover:bg-black"
                      >
                        Export PNG
                      </button>

                      <button
                        onClick={() => removeImage(item.id)}
                        className="rounded-2xl border border-black/15 bg-white px-4 py-3 font-bold text-black hover:bg-black hover:text-white"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PreviewImage({
  imageUrl,
  name,
  previewClass,
  fitMode,
}: {
  imageUrl: string;
  name: string;
  previewClass: string;
  fitMode: FitMode;
}) {
  if (fitMode === "smart") {
    return (
      <div className="rounded-[20px] bg-[#e8e8e1] p-4">
        <div
          className={`relative mx-auto w-full max-w-[260px] overflow-hidden bg-[#f4f4f1] ${previewClass}`}
        >
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />

          <div className="absolute inset-0 bg-black/10" />

          <img
            src={imageUrl}
            alt={name}
            className="relative z-10 h-full w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (fitMode === "fill") {
    return (
      <div className="rounded-[20px] bg-[#e8e8e1] p-4">
        <div
          className={`mx-auto w-full max-w-[260px] overflow-hidden bg-[#f4f4f1] ${previewClass}`}
        >
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-[#e8e8e1] p-4">
      <div
        className={`mx-auto flex w-full max-w-[260px] items-center justify-center overflow-hidden bg-[#f4f4f1] ${previewClass}`}
      >
        <img
          src={imageUrl}
          alt={name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
}