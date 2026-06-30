# 🔐 FINAL SOLUTION: Admin Lock/Unlock Slots

## ⚠️ **CRITICAL STEP: Create BlockedSlot Table**

**You MUST run this SQL script first before the lock/unlock will work:**

### Steps:
1. Open **SQL Server Management Studio** (SSMS)
2. Connect to server: `ABDUL\SQLEXPRESS`
3. Open file: `d:\Backend\turf\CREATE_BLOCKED_SLOT_TABLE.sql`
4. Click **Execute** (or press F5)
5. You should see: "BlockedSlot table created successfully!"

### If you created BlockedSlot earlier (old schema)
Run: `d:\Backend\turf\ALTER_BLOCKED_SLOT_TABLE.sql` in SSMS.

---

## ✅ **How It Works**

### Lock Slot (Disable):
- Inserts a row into `BlockedSlot` table
- Slot becomes unavailable for booking on that specific date

### Unlock Slot (Enable):
- Deletes the row from `BlockedSlot` table  
- Slot becomes available for booking again

---

## 📡 **API Endpoints**

### 1. Lock Single Slot
```
POST http://localhost:5000/api/admin/lock-slot

Body (JSON):
{
  "slotId": "S1",
  "date": "2026-02-20"
}

Response:
{
  "success": true,
  "message": "Slot locked (disabled)"
}
```

### 2. Unlock Single Slot
```
POST http://localhost:5000/api/admin/unlock-slot

Body (JSON):
{
  "slotId": "S1",
  "date": "2026-02-20"
  ,"unlockReason": "Maintenance completed"
}

Response:
{
  "success": true,
  "message": "Slot unlocked (enabled)"
}
```

### 3. Lock Multiple Slots
```
POST http://localhost:5000/api/admin/lock-slots

Body (JSON):
{
  "date": "2026-02-20",
  "slotIds": ["S1", "S2", "S3"]
}

Response:
{
  "message": "Slots locked (disabled)"
}
```

### 4. Unlock Multiple Slots
```
POST http://localhost:5000/api/admin/unlock-slots

Body (JSON):
{
  "date": "2026-02-20",
  "slotIds": ["S1", "S2", "S3"]
}

Response:
{
  "message": "Slots unlocked (enabled)"
}
```

---

## 🎨 **Frontend Integration**

Update your React/Vue frontend:

```javascript
// Lock a slot
const lockSlot = async (slotId, date) => {
  try {
    const response = await axios.post('http://localhost:5000/api/admin/lock-slot', {
      slotId,
      date  // Format: 'YYYY-MM-DD'
    });
    console.log(response.data.message);
    // Refresh calendar to show locked slot
  } catch (error) {
    console.error('Lock failed:', error.response?.data);
  }
};

// Unlock a slot
const unlockSlot = async (slotId, date) => {
  try {
    const response = await axios.post('http://localhost:5000/api/admin/unlock-slot', {
      slotId,
      date,
      unlockReason: 'Open again'
    });
    console.log(response.data.message);
    // Refresh calendar to show available slot
  } catch (error) {
    console.error('Unlock failed:', error.response?.data);
  }
};

// The frontend calendar will automatically show locked slots as unavailable
// because the /api/booked-slots endpoint returns both booked AND blocked slots
```

---

## 🔄 **How Frontend Calendar Gets Locked Slots**

The `/api/booked-slots` endpoint already returns locked slots:

```javascript
// This endpoint returns BOTH:
// 1. Booked slots (from BookingSlot table)
// 2. Locked slots (from BlockedSlot table)
GET http://localhost:5000/api/booked-slots?from=2026-02-01&to=2026-02-28

Response:
{
  "blocked": [
    { "date": "2026-02-20", "slotId": "S1" },  // Could be booked OR locked
    { "date": "2026-02-21", "slotId": "S2" }
  ]
}
```

Your frontend calendar treats locked slots the same as booked slots - both are disabled/unavailable.

---

## 🚀 **Testing**

After creating the BlockedSlot table, restart your server:

```powershell
# Stop server
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start server
cd d:\Backend\turf
node Server.js
```

Then test manually or run:
```powershell
node test_lock_unlock.js
```

---

## ✨ **Summary of Changes**

1. ✅ Created `adminSlotRoutes.js` - uses `BlockedSlot` table
2. ✅ Updated `slot.js` - returns both booked and blocked slots via UNION  
3. ✅ Created SQL script to create `BlockedSlot` table
4. ❌ Abandoned `adminSlots.js` - doesn't work because Booking table has auto-generated BookingId trigger

---

## 🔧 **Troubleshooting**

### Error: "Invalid object name 'BlockedSlot'"
**Solution:** You haven't created the BlockedSlot table yet. Run `CREATE_BLOCKED_SLOT_TABLE.sql` in SSMS.

### Lock button doesn't disable slot
**Solution:**  
1. Check browser console for API errors
2. Verify the API endpoint URL is correct
3. Make sure date format is 'YYYY-MM-DD'
4. Check that SlotId matches your database (S1, S2, etc.)

### Slot is locked but still shows as available
**Solution:** Make sure your frontend is calling `/api/booked-slots` to get locked slots and marking them as disabled in the calendar.
