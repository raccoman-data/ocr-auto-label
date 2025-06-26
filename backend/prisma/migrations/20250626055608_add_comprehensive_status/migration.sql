-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "newName" TEXT,
    "filePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "fileSize" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "group" TEXT,
    "geminiStatus" TEXT NOT NULL DEFAULT 'pending',
    "groupingStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "code" TEXT,
    "otherText" TEXT,
    "objectDesc" TEXT,
    "objectColors" TEXT,
    "geminiConfidence" REAL,
    "groupingConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_images" ("code", "createdAt", "filePath", "fileSize", "geminiConfidence", "geminiStatus", "group", "groupingConfidence", "groupingStatus", "id", "newName", "objectColors", "objectDesc", "originalName", "otherText", "thumbnailPath", "timestamp", "updatedAt") SELECT "code", "createdAt", "filePath", "fileSize", "geminiConfidence", "geminiStatus", "group", "groupingConfidence", "groupingStatus", "id", "newName", "objectColors", "objectDesc", "originalName", "otherText", "thumbnailPath", "timestamp", "updatedAt" FROM "images";
DROP TABLE "images";
ALTER TABLE "new_images" RENAME TO "images";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
