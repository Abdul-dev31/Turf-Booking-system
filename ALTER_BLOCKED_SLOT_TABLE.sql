-- ============================================
-- ALTER BlockedSlot TABLE (ADD LOCK/UNLOCK REASONS + STATE)
-- ============================================
-- Run this script if you created BlockedSlot using the old schema.
-- Database: turf_org
-- ============================================

USE turf_org;
GO

IF OBJECT_ID(N'[dbo].[BlockedSlot]', N'U') IS NULL
BEGIN
  PRINT 'BlockedSlot table does not exist. Run CREATE_BLOCKED_SLOT_TABLE.sql first.';
  RETURN;
END
GO

IF COL_LENGTH('dbo.BlockedSlot', 'IsActive') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD IsActive BIT NOT NULL CONSTRAINT DF_BlockedSlot_IsActive DEFAULT(1);
END

IF COL_LENGTH('dbo.BlockedSlot', 'LockedAt') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD LockedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BlockedSlot_LockedAt DEFAULT(SYSUTCDATETIME());
END

IF COL_LENGTH('dbo.BlockedSlot', 'LockedBy') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD LockedBy VARCHAR(50) NULL;
END

IF COL_LENGTH('dbo.BlockedSlot', 'LockReason') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD LockReason NVARCHAR(255) NULL;
END

IF COL_LENGTH('dbo.BlockedSlot', 'UnlockedAt') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD UnlockedAt DATETIME2(0) NULL;
END

IF COL_LENGTH('dbo.BlockedSlot', 'UnlockedBy') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD UnlockedBy VARCHAR(50) NULL;
END

IF COL_LENGTH('dbo.BlockedSlot', 'UnlockReason') IS NULL
BEGIN
  ALTER TABLE dbo.BlockedSlot ADD UnlockReason NVARCHAR(255) NULL;
END
GO

PRINT 'BlockedSlot table altered successfully.';
GO

SELECT TOP 50 * FROM dbo.BlockedSlot ORDER BY BlockDate DESC, SlotId;
GO
