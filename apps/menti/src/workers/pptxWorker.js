import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { connectMongo } from "../core/database/connect.js";
import env from "../core/env/env.js";
import { redis } from "../core/database/redis.js";
import { PPTX_JOB_QUEUE, IMPORT_PROGRESS_CHANNEL } from "../core/keys.js";
import { PowerPointImport, Slide, PresentationAsset } from "../core/database/models/index.js";
import { storageService } from "../core/storage/storage.service.js";

// Helper for execFile commands to prevent shell command injection
function execFilePromise(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            `Command failed: ${file} ${args.join(" ")}\nError: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`
          )
        );
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Locate LibreOffice (soffice) executable
function getSofficePath() {
  if (process.env.SOFFICE_PATH) {
    return process.env.SOFFICE_PATH;
  }
  if (process.platform === "darwin") {
    // Check common Mac installation path
    const macPath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
    if (existsSync(macPath)) {
      return macPath;
    }
  }
  return "soffice"; // Default to system PATH
}

// Locate pdftoppm executable
function getPdftoppmPath() {
  return process.env.PDFTOPPM_PATH || "pdftoppm";
}

// Publish progress helper
async function publishProgress(pptxImport) {
  const payload = {
    userId: pptxImport.userId.toString(),
    presentationId: pptxImport.presentationId.toString(),
    importId: pptxImport._id.toString(),
    status: pptxImport.status,
    processedSlides: pptxImport.processedSlides,
    totalSlides: pptxImport.totalSlides,
    errorInfo: pptxImport.errorInfo || null,
  };
  try {
    await redis.publish(IMPORT_PROGRESS_CHANNEL, JSON.stringify(payload));
  } catch (err) {
    console.error("[Worker] Failed to publish progress to Redis:", err.message);
  }
}

// Cancellation check helper
async function checkCancelled(importId) {
  const pptxImport = await PowerPointImport.findById(importId).select("status");
  if (pptxImport && pptxImport.status === "CANCELLED") {
    console.log(`[Worker] Job ${importId} was cancelled by user.`);
    return true;
  }
  return false;
}

// Rollback partial changes (clean up database slides and local uploads)
async function rollbackImport(pptxImport) {
  console.log(`[Worker] Rolling back partial changes for import job: ${pptxImport._id}`);

  // 1. Delete Slides created by this import
  const deletedSlides = await Slide.find({
    presentationId: pptxImport.presentationId,
    "metadata.importId": pptxImport._id,
  }).lean();

  if (deletedSlides.length > 0) {
    console.log(`[Worker] Deleting ${deletedSlides.length} partial slides...`);
    await Slide.deleteMany({
      presentationId: pptxImport.presentationId,
      "metadata.importId": pptxImport._id,
    });
  }

  // 2. Delete PresentationAsset records & files from storage
  const assets = await PresentationAsset.find({ importId: pptxImport._id }).lean();
  for (const asset of assets) {
    console.log(`[Worker] Deleting asset file: ${asset.storageKey}`);
    await storageService.deleteFile(asset.storageKey);
  }
  if (assets.length > 0) {
    await PresentationAsset.deleteMany({ importId: pptxImport._id });
  }

  // 3. Shift remaining slides back if they were shifted forward
  if (pptxImport.hasShiftedSlides && pptxImport.totalSlides > 0) {
    console.log(
      `[Worker] Rolling back slide positions: shifting back by ${pptxImport.totalSlides} from position ${pptxImport.targetPosition}...`
    );
    await Slide.updateMany(
      {
        presentationId: pptxImport.presentationId,
        position: { $gte: pptxImport.targetPosition },
      },
      { $inc: { position: -pptxImport.totalSlides } }
    );
    pptxImport.hasShiftedSlides = false;
    await pptxImport.save();
  }
}

// Core processing logic
async function processImport(importId) {
  console.log(`[Worker] Starting import job: ${importId}`);
  const pptxImport = await PowerPointImport.findById(importId);
  if (!pptxImport) {
    console.error(`[Worker] Import record not found: ${importId}`);
    return;
  }

  if (pptxImport.status === "CANCELLED") {
    console.log(`[Worker] Job ${importId} was cancelled before processing started.`);
    return;
  }

  // Set processing status
  pptxImport.status = "PROCESSING";
  pptxImport.startedAt = new Date();
  await pptxImport.save();
  await publishProgress(pptxImport);

  let tempDir = null;
  try {
    // 1. Create a temporary folder
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `pptx-import-${importId}-`));
    await fs.chmod(tempDir, 0o777);
    console.log(`[Worker] Created temporary import directory: "${tempDir}"`);

    // 2. Retrieve original PowerPoint file from storage (works for both local disk & Cloudflare R2)
    const originalExt = path.extname(pptxImport.originalName || "") || ".pptx";
    const tempPptxPath = path.join(tempDir, `input${originalExt}`);
    console.log(
      `[Worker] Downloading PowerPoint file (originalName="${pptxImport.originalName}") from storage key "${pptxImport.storageKey}" -> destination path "${tempPptxPath}"...`
    );

    await storageService.downloadFile(pptxImport.storageKey, tempPptxPath);
    try {
      await fs.chmod(tempPptxPath, 0o666);
    } catch {}

    const stat = await fs.stat(tempPptxPath);
    console.log(
      `[Worker] Verified downloaded file at "${tempPptxPath}": size=${stat.size} bytes (${(stat.size / 1024 / 1024).toFixed(2)} MB).`
    );

    try {
      const fileHandle = await fs.open(tempPptxPath, "r");
      const headerBuf = Buffer.alloc(4);
      await fileHandle.read(headerBuf, 0, 4, 0);
      await fileHandle.close();
      const isZipHeader =
        headerBuf[0] === 0x50 &&
        headerBuf[1] === 0x4b &&
        headerBuf[2] === 0x03 &&
        headerBuf[3] === 0x04;
      console.log(
        `[Worker] File header magic bytes: 0x${headerBuf.toString("hex").toUpperCase()} (isZipArchive=${isZipHeader})`
      );
      if (!isZipHeader && originalExt.toLowerCase() === ".pptx") {
        console.warn(
          `[Worker] Warning: File "${tempPptxPath}" does not start with standard PK zip header (0x504B0304). Header bytes: 0x${headerBuf.toString("hex").toUpperCase()}`
        );
      }
    } catch (headerErr) {
      console.warn(`[Worker] Failed to read magic bytes header:`, headerErr.message);
    }

    const filesAfterDownload = await fs.readdir(tempDir);
    console.log(`[Worker] Directory contents of "${tempDir}" after download: [${filesAfterDownload.join(", ")}]`);

    if (stat.size === 0) {
      throw new Error(`Downloaded PowerPoint file is 0 bytes (${pptxImport.storageKey}). Upload may have failed.`);
    }

    // 3. Convert to PDF using LibreOffice headless with multi-tier fallback
    const soffice = getSofficePath();
    const profileDir = path.join(tempDir, "libreoffice-profile");
    await fs.mkdir(profileDir, { recursive: true });
    try {
      await fs.chmod(profileDir, 0o777);
    } catch {}

    console.log(`[Worker] Executing LibreOffice command: ${soffice} --headless --convert-to pdf --outdir "${tempDir}" "${tempPptxPath}"`);

    let lastLog = "";

    // Attempt 1: Isolated user profile with standard PDF export
    try {
      const res = await execFilePromise(soffice, [
        `-env:UserInstallation=file://${path.resolve(profileDir)}`,
        "--headless",
        "--invisible",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--nocrashreport",
        "--convert-to",
        "pdf",
        "--outdir",
        tempDir,
        tempPptxPath,
      ]);
      lastLog = res.stdout || res.stderr || "";
    } catch (err1) {
      console.warn("[Worker] Primary LibreOffice conversion failed, trying standard fallback:", err1.message);
      lastLog = err1.message;

      // Attempt 2: Standard headless conversion
      try {
        const res2 = await execFilePromise(soffice, [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          tempDir,
          tempPptxPath,
        ]);
        lastLog = res2.stdout || res2.stderr || "";
      } catch (err2) {
        console.warn("[Worker] Secondary conversion failed, trying explicit filter fallback:", err2.message);
        lastLog = err2.message;

        // Attempt 3: Explicit impress filter fallback
        try {
          const res3 = await execFilePromise(soffice, [
            "--headless",
            "--convert-to",
            "pdf:impress_pdf_Export",
            "--outdir",
            tempDir,
            tempPptxPath,
          ]);
          lastLog = res3.stdout || res3.stderr || "";
        } catch (err3) {
          console.warn("[Worker] Tertiary conversion failed:", err3.message);
          lastLog = err3.message;
        }
      }
    }

    if (lastLog) {
      console.log(`[Worker] LibreOffice conversion output: "${lastLog.trim()}"`);
    }

    const tempDirFiles = await fs.readdir(tempDir);
    const pdfFilename = tempDirFiles.find((f) => f.toLowerCase().endsWith(".pdf"));

    if (!pdfFilename) {
      throw new Error(
        `LibreOffice conversion failed: PDF file was not generated. Files in temp dir: [${tempDirFiles.join(", ")}]. Logs: ${lastLog || "none"}`
      );
    }

    const tempPdfPath = path.join(tempDir, pdfFilename);

    // 4. Render PDF pages to PNG images using pdftoppm safely
    const pdftoppm = getPdftoppmPath();
    console.log(`[Worker] Rendering PDF to PNG images using ${pdftoppm}...`);
    await execFilePromise(pdftoppm, [
      "-png",
      "-r",
      "150",
      tempPdfPath,
      path.join(tempDir, "slide"),
    ]);

    // 5. Read temp directory and sort slide image files
    const files = await fs.readdir(tempDir);
    const slideImageFiles = files
      .filter((f) => f.startsWith("slide-") && f.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide-(\d+)\.png/)[1], 10);
        const numB = parseInt(b.match(/slide-(\d+)\.png/)[1], 10);
        return numA - numB;
      });

    const totalSlidesCount = slideImageFiles.length;
    if (totalSlidesCount === 0) {
      throw new Error("No slides were extracted from the PowerPoint file.");
    }

    console.log(`[Worker] Successfully rendered ${totalSlidesCount} slide images.`);
    pptxImport.totalSlides = totalSlidesCount;
    await pptxImport.save();
    await publishProgress(pptxImport);

    // Check cancellation
    if (await checkCancelled(importId)) {
      await rollbackImport(pptxImport);
      return;
    }

    // 6. Shift positions of existing slides (Idempotent: only run once)
    if (!pptxImport.hasShiftedSlides) {
      console.log(
        `[Worker] Shifting slide positions by ${totalSlidesCount} from position ${pptxImport.targetPosition}...`
      );
      await Slide.updateMany(
        {
          presentationId: pptxImport.presentationId,
          position: { $gte: pptxImport.targetPosition },
        },
        { $inc: { position: totalSlidesCount } }
      );
      pptxImport.hasShiftedSlides = true;
      await pptxImport.save();
    }

    // Check cancellation
    if (await checkCancelled(importId)) {
      await rollbackImport(pptxImport);
      return;
    }

    // 7. Sequentially upload slides to storage and insert into presentation
    for (let index = 0; index < totalSlidesCount; index++) {
      const slideNum = index + 1;
      const slideFilename = slideImageFiles[index];
      const localSlidePath = path.join(tempDir, slideFilename);

      // Check cancellation before processing this slide
      if (await checkCancelled(importId)) {
        await rollbackImport(pptxImport);
        return;
      }

      // Check if PresentationAsset already exists (Retry Safety)
      let asset = await PresentationAsset.findOne({
        importId: pptxImport._id,
        slideNumber: slideNum,
      });

      const destKey = `imports/${pptxImport.presentationId}/${importId}/slide-${slideNum}.png`;

      if (!asset) {
        console.log(`[Worker] Uploading slide image ${slideNum}/${totalSlidesCount}...`);
        await storageService.uploadFile(localSlidePath, destKey);

        asset = await PresentationAsset.create({
          presentationId: pptxImport.presentationId,
          url: storageService.getUrl(destKey),
          storageKey: destKey,
          source: "pptx_import",
          importId: pptxImport._id,
          slideNumber: slideNum,
        });
      }

      // Check if Slide already exists (Idempotency)
      const targetSlidePos = pptxImport.targetPosition + index;
      let slide = await Slide.findOne({
        presentationId: pptxImport.presentationId,
        "metadata.importId": pptxImport._id,
        "metadata.originalSlideNumber": slideNum,
      });

      if (!slide) {
        console.log(
          `[Worker] Creating CONTENT slide for slide ${slideNum}/${totalSlidesCount} at position ${targetSlidePos}...`
        );
        slide = await Slide.create({
          presentationId: pptxImport.presentationId,
          type: "CONTENT",
          position: targetSlidePos,
          question: `Slide ${slideNum}`,
          designSettings: {
            contentImageUrl: asset.url,
            backgroundColor: "#ffffff",
            textColor: "#1a1d29",
          },
          metadata: {
            source: "pptx_import",
            importId: pptxImport._id,
            originalSlideNumber: slideNum,
            assetId: asset._id,
          },
        });
      }

      // Update progress
      pptxImport.processedSlides = slideNum;
      await pptxImport.save();
      await publishProgress(pptxImport);
    }

    // 8. Mark completed
    pptxImport.status = "COMPLETED";
    pptxImport.completedAt = new Date();
    await pptxImport.save();
    await publishProgress(pptxImport);
    console.log(`[Worker] PowerPoint import completed successfully for ${importId}`);

  } catch (error) {
    console.error(`[Worker] Import job failed for ${importId}:`, error.message);

    // Roll back changes to ensure database and presentation state remains consistent
    try {
      await rollbackImport(pptxImport);
    } catch (rollbackErr) {
      console.error(`[Worker] Rollback failed:`, rollbackErr.message);
    }

    pptxImport.status = "FAILED";
    pptxImport.errorInfo = error.message;
    pptxImport.completedAt = new Date();
    await pptxImport.save();
    await publishProgress(pptxImport);
  } finally {
    // 9. Clean up temporary files
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[Worker] Failed to clean up temp dir ${tempDir}:`, err.message);
      }
    }
  }
}

// Connect to MongoDB and run loop
async function startWorker() {
  console.log("[Worker] Connecting to MongoDB...");
  const [connection, error] = await connectMongo(env.MONGO_URI);
  if (error) {
    console.error("[Worker] MongoDB connection failed:", error);
    process.exit(1);
  }
  console.log("[Worker] MongoDB connected.");

  let isShuttingDown = false;

  // Handle graceful shutdowns
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("[Worker] Shutting down worker process...");
    try {
      await redis.quit();
    } catch (err) {}
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[Worker] PPTX background worker initialized. Polling for jobs...");
  while (!isShuttingDown) {
    try {
      const job = await redis.brpop(PPTX_JOB_QUEUE, 2);
      if (job) {
        const importId = job[1];
        await processImport(importId);
      }
    } catch (err) {
      if (err.message && err.message.includes("Connection is closed")) {
        console.error("[Worker] Redis connection lost. Retrying in 5 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error("[Worker] Error in worker loop:", err);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}

startWorker();
