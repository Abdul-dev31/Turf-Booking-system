# PowerShell Script to Create BlockedSlot Table
# Run this if you don't want to use SQL Server Management Studio

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Creating BlockedSlot Table" -ForegroundColor Cyan  
Write-Host "=====================================" -ForegroundColor Cyan

$serverName = "ABDUL\SQLEXPRESS"
$database = "turf_org"

$createTableSQL = @"
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BlockedSlot]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[BlockedSlot] (
        SlotId VARCHAR(10) NOT NULL,
        BlockDate DATE NOT NULL,
        CONSTRAINT PK_BlockedSlot PRIMARY KEY (SlotId, BlockDate),
        CONSTRAINT FK_BlockedSlot_Slot FOREIGN KEY (SlotId) REFERENCES [dbo].[Slot](SlotId)
    );
    SELECT 'BlockedSlot table created successfully!' AS Result;
END
ELSE
BEGIN
    SELECT 'BlockedSlot table already exists.' AS Result;
END
"@

try {
    Write-Host "`nConnecting to SQL Server..." -ForegroundColor Yellow
    Write-Host "Server: $serverName" - ForegroundColor Gray
    Write-Host "Database: $database`n" -ForegroundColor Gray
    
    # Execute the SQL command
    $result = Invoke-Sqlcmd -ServerInstance $serverName -Database $database -Query $createTableSQL -ErrorAction Stop
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host $result.Result -ForegroundColor Green
    
    # Verify the table exists
    $verifySQL = "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BlockedSlot'"
    $verify = Invoke-Sqlcmd -ServerInstance $serverName -Database $database -Query $verifySQL
    
    if ($verify) {
        Write-Host "`n✅ Verification: BlockedSlot table exists in database" -ForegroundColor Green
        Write-Host "`nYou can now use the lock/unlock endpoints!" -ForegroundColor Cyan
        Write-Host "Restart your Node.js server and test the lock button.`n" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "`n❌ ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    Write-Host "`n💡 SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Install SqlServer PowerShell module:" -ForegroundColor Gray
    Write-Host "   Install-Module -Name SqlServer -AllowClobber`n" -ForegroundColor White
    Write-Host "2. OR use SQL Server Management Studio (SSMS):" -ForegroundColor Gray
    Write-Host "   - Open d:\Backend\turf\CREATE_BLOCKED_SLOT_TABLE.sql" -ForegroundColor White
    Write-Host "   - Press F5 to execute`n" -ForegroundColor White
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
