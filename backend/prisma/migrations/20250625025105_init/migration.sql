-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "newName" TEXT,
    "filePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "fileSize" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "group" TEXT,
    "paletteStatus" TEXT NOT NULL DEFAULT 'pending',
    "geminiStatus" TEXT NOT NULL DEFAULT 'pending',
    "groupingStatus" TEXT NOT NULL DEFAULT 'pending',
    "palette" TEXT,
    "code" TEXT,
    "otherText" TEXT,
    "objectDesc" TEXT,
    "paletteConfidence" REAL,
    "geminiConfidence" REAL,
    "groupingConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
