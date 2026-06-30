-- Run this in SQL Server Management Studio to check if BlockedSlot table exists

-- Check if table exists
SELECT * FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME = 'BlockedSlot';

-- If table doesn't exist, create it:
CREATE TABLE BlockedSlot (
    SlotId VARCHAR(10) NOT NULL,
    BlockDate DATE NOT NULL,
    PRIMARY KEY (SlotId, BlockDate)
);

-- Verify the table structure
SELECT * FROM BlockedSlot;
