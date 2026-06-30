-- ============================================
-- CREATE BlockedSlot TABLE FOR ADMIN LOCK/UNLOCK
-- ============================================
-- Run this script in SQL Server Management Studio
-- Database: turf_org
-- Server: ABDUL\SQLEXPRESS
-- ============================================

USE turf_org;
GO

-- Check if table already exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BlockedSlot]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[BlockedSlot] (
        SlotId VARCHAR(10) NOT NULL,
        BlockDate DATE NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_BlockedSlot_IsActive DEFAULT(1),
        LockedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BlockedSlot_LockedAt DEFAULT(SYSUTCDATETIME()),
        LockedBy VARCHAR(50) NULL,
        LockReason NVARCHAR(255) NULL,
        UnlockedAt DATETIME2(0) NULL,
        UnlockedBy VARCHAR(50) NULL,
        UnlockReason NVARCHAR(255) NULL,
        CONSTRAINT PK_BlockedSlot PRIMARY KEY (SlotId, BlockDate),
        CONSTRAINT FK_BlockedSlot_Slot FOREIGN KEY (SlotId) REFERENCES [dbo].[Slot](SlotId)
    );
    
    PRINT 'BlockedSlot table created successfully!';
END
ELSE
BEGIN
    PRINT 'BlockedSlot table already exists.';
END
GO

-- Verify the table was created
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BlockedSlot';
GO

-- Show the structure
sp_help 'BlockedSlot';
GO
