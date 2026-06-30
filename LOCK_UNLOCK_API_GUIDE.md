# 🔐 Admin Lock/Unlock API Endpoints

## Base URL: `http://localhost:5000/api`

---

## ✅ Available Endpoints (FIXED)

### 1. Lock Single Slot (Disable)
**Endpoint:** `POST /api/admin/lock-slot`

**Body:**
```json
{
  "slotId": "S1",
  "date": "2026-02-20",
  "lockReason": "Maintenance",
  "lockedBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Slot locked (disabled)"
}
```

---

### 2. Unlock Single Slot (Enable)
**Endpoint:** `POST /api/admin/unlock-slot`

**Body:**
```json
{
  "slotId": "S1",
  "date": "2026-02-20",
  "unlockReason": "Maintenance completed",
  "unlockedBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Slot unlocked (enabled)"
}
```

---

### 3. Lock Multiple Slots (Disable)
**Endpoint:** `POST /api/admin/lock-slots`

**Body:**
```json
{
  "date": "2026-02-20",
  "slotIds": ["S1", "S2", "S3"]
}
```

**Response:**
```json
{
  "message": "Slots locked (disabled)"
}
```

---

### 4. Unlock Multiple Slots (Enable)
**Endpoint:** `POST /api/admin/unlock-slots`

**Body:**
```json
{
  "date": "2026-02-20",
  "slotIds": ["S1", "S2", "S3"],
  "unlockReason": "Open again",
  "unlockedBy": "admin"
}
```

**Response:**
```json
{
  "message": "Slots unlocked (enabled)"
}
```

---

## 📊 How It Works

1. **Lock (Disable)** = Upsert into `BlockedSlot` (sets `IsActive=1`)
2. **Unlock (Enable)** = Update `BlockedSlot` (sets `IsActive=0` and stores `unlockReason`)
3. The `/api/booked-slots` endpoint includes locked slots in the blocked list using UNION query
4. Frontend calendar will show locked slots as unavailable

---

## 👤 Admin: Get User Details + Lock Status

### A) Get bookings/user details for a slot+date
**Endpoint:** `GET /api/admin/slot-bookings?slotId=S1&date=2026-02-20`

### B) Get lock status for a slot+date
**Endpoint:** `GET /api/admin/lock-status?slotId=S1&date=2026-02-20`

### C) Get locked slots in date range
**Endpoint:** `GET /api/admin/locked-slots?from=2026-02-01&to=2026-02-28`

---

## 🗄️ Database Table

```sql
CREATE TABLE BlockedSlot (
    SlotId VARCHAR(10) NOT NULL,
    BlockDate DATE NOT NULL,
  IsActive BIT NOT NULL DEFAULT(1),
  LockedAt DATETIME2 NOT NULL DEFAULT(SYSUTCDATETIME()),
  LockedBy VARCHAR(50) NULL,
  LockReason NVARCHAR(255) NULL,
  UnlockedAt DATETIME2 NULL,
  UnlockedBy VARCHAR(50) NULL,
  UnlockReason NVARCHAR(255) NULL,
    PRIMARY KEY (SlotId, BlockDate)
);
```

If you already created the table with the old schema, run: `ALTER_BLOCKED_SLOT_TABLE.sql`.

---

## 🧪 Testing

1. Run the test file:
   ```bash
   cd d:\Backend\turf
   node test_lock_unlock.js
   ```

2. Or test manually using Postman/Thunder Client:
   - URL: `http://localhost:5000/api/admin/lock-slot`
   - Method: POST
   - Body: Raw JSON
   - Add your slot ID and date

---

## ⚠️ Changes Made

1. ✅ Removed duplicate routes from `slot.js`
2. ✅ Disabled conflicting `adminSlots.js` route registration
3. ✅ All lock/unlock now uses `BlockedSlot` table (not BookingSlot)
4. ✅ All endpoints are now in `adminSlotRoutes.js`
5. ✅ Consistent table names and column names

---

## 🔧 Frontend Update Needed

Update your frontend API calls to:
```javascript
// Lock slot
await axios.post('http://localhost:5000/api/admin/lock-slot', {
  slotId: 'S1',
  date: '2026-02-20'
});

// Unlock slot
await axios.post('http://localhost:5000/api/admin/unlock-slot', {
  slotId: 'S1',
  date: '2026-02-20'
});

// Lock multiple
await axios.post('http://localhost:5000/api/admin/lock-slots', {
  date: '2026-02-20',
  slotIds: ['S1', 'S2', 'S3']
});

// Unlock multiple
await axios.post('http://localhost:5000/api/admin/unlock-slots', {
  date: '2026-02-20',
  slotIds: ['S1', 'S2', 'S3']
});
```
