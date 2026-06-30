-- Create OTPTable for Fast2SMS OTP management
CREATE TABLE OTPTable (
    OTP_ID INT PRIMARY KEY IDENTITY(1,1),
    Mobile_Number VARCHAR(10) NOT NULL,
    OTP VARCHAR(10) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    ExpiresAt DATETIME NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_mobile_otp ON OTPTable(Mobile_Number, OTP, ExpiresAt);

-- Optional: Create a cleanup job to delete expired OTPs (run this monthly)
-- DELETE FROM OTPTable WHERE ExpiresAt < GETDATE();
