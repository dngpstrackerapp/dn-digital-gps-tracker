import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { 
  getUsers, 
  getUser, 
  getUserByEmail, 
  saveUser, 
  deleteUser, 
  getDrivers, 
  getDriver, 
  saveDriver, 
  updateDriver, 
  deleteDriver, 
  getTripReports, 
  saveTripReport, 
  getActiveTripReport, 
  endOngoingTrips, 
  getLocationLogs, 
  saveLocationLog, 
  deleteLocationLogsForDriver, 
  deleteTripReportsForDriver,
  deleteTripReport,
  seedDatabaseIfEmpty,
  auth,
  loginWithFirebaseAuth
} from './src/lib/firebaseService.js';

// Express setup
const app = express();
const PORT = 3000;

app.use(express.json());

// Enable permissive CORS for sandboxed development iframes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Resolve paths for ES Modules / CommonJS
const getCJSFilename = () => {
  try {
    return __filename;
  } catch {
    return '';
  }
};

const getCJSDirname = () => {
  try {
    return __dirname;
  } catch {
    return '';
  }
};

const resolvedFilename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : getCJSFilename();

const resolvedDirname = typeof import.meta !== 'undefined' && import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : getCJSDirname();

// ==========================================
// API ENDPOINTS (POWERED BY FIRESTORE)
// ==========================================

// Auth: Login / Only Sign-In is allowed publicly
app.post('/api/auth/login', async (req, res) => {
  const { email, password, isRegister } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    if (isRegister) {
      return res.status(400).json({ error: 'Public registration is disabled. Please contact the administrator to create a driver account.' });
    }

    // Authenticate using the new Firebase Authentication service
    const user = await loginWithFirebaseAuth(email, password);
    
    // Set driver status to 'offline' on login (Requirement: Driver Login = Offline)
    if (user && user.role === 'driver') {
      const driver = await getDriver(user.id);
      if (driver) {
        driver.status = 'offline';
        await saveDriver(driver);
      }
    }

    return res.json({ user });
  } catch (error: any) {
    const isAuthError = error.code === 'auth/wrong-password' || 
                        error.code === 'auth/invalid-credential' || 
                        error.code === 'auth/user-not-found' ||
                        (error.message && error.message.includes('invalid-credential'));

    if (isAuthError) {
      console.warn('Unauthorized login attempt:', error.message || error);
      return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
    }

    console.error('Error in login route:', error);
    return res.status(500).json({ error: 'Authentication service error occurred: ' + (error.message || error) });
  }
});

// POST: Change password
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  try {
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (oldPassword && user.password && user.password !== oldPassword) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }
    user.password = newPassword;
    await saveUser(user);
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// GET: All active drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const driversList = await getDrivers();
    const reports = await getTripReports();
    const activeDriverIds = new Set(
      reports.filter(r => r.status === 'ongoing').map(r => r.driverId)
    );

    const updatedDrivers = driversList.map(driver => {
      const isOngoing = activeDriverIds.has(driver.id);
      return {
        ...driver,
        status: (isOngoing ? 'active' : 'offline') as 'active' | 'offline'
      };
    });

    return res.json(updatedDrivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ error: 'Failed to fetch active drivers.' });
  }
});

// POST: Add a new driver (from Admin interface)
app.post('/api/drivers', async (req, res) => {
  const { 
    id, // custom driver ID *
    name, // Driver Name *
    dob, 
    phone, // Mobile Number *
    email, // Email Address (Login ID) *
    password, // Password *
    address, 
    vehiclePlate, // Vehicle Number *
    vehicleNameType, 
    licenseNumber, 
    licenseExpiry, 
    emergencyContact,
    status // Status (Active / Inactive)
  } = req.body;

  if (!id || !name || !phone || !email || !password || !vehiclePlate) {
    return res.status(400).json({ error: 'Driver Name, Driver ID, Mobile Number, Email, Password, and Vehicle Number are required.' });
  }

  try {
    // Check if driver or user ID already exists
    const existingDriver = await getDriver(id);
    const existingUser = await getUser(id);
    if (existingDriver || existingUser) {
      return res.status(400).json({ error: 'A driver with this Driver ID already exists.' });
    }

    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'A user with this Email Address already exists.' });
    }

    const companyName = 'DN GPS Tracker';

    const newDriver = {
      id,
      name,
      dob: dob || '',
      phone,
      email: email.toLowerCase(),
      password,
      address: address || '',
      vehiclePlate,
      vehicleNameType: vehicleNameType || '',
      licenseNumber: licenseNumber || '',
      licenseExpiry: licenseExpiry || '',
      emergencyContact: emergencyContact || '',
      companyName,
      status: 'offline' as const,
      lastLatitude: null,
      lastLongitude: null,
      lastActive: null
    };

    await saveDriver(newDriver);

    // Create the linked user so they can login
    await saveUser({
      id,
      email: email.toLowerCase(),
      password,
      name,
      role: 'driver',
      phone,
      vehiclePlate,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json(newDriver);
  } catch (error: any) {
    console.error('Error creating driver:', error);
    return res.status(500).json({ error: 'Failed to create driver: ' + error.message });
  }
});

// PUT: Edit driver (from Admin interface)
app.put('/api/drivers/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    name,
    dob,
    phone,
    email,
    password,
    address,
    vehiclePlate,
    vehicleNameType,
    licenseNumber,
    licenseExpiry,
    emergencyContact,
    status 
  } = req.body;
  
  try {
    const driver = await getDriver(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const updatedDriver = {
      ...driver,
      name: name !== undefined ? name : driver.name,
      dob: dob !== undefined ? dob : (driver.dob || ''),
      phone: phone !== undefined ? phone : driver.phone,
      email: email !== undefined ? email.toLowerCase() : (driver.email || ''),
      password: password !== undefined && password !== '' ? password : (driver.password || ''),
      address: address !== undefined ? address : (driver.address || ''),
      vehiclePlate: vehiclePlate !== undefined ? vehiclePlate : driver.vehiclePlate,
      vehicleNameType: vehicleNameType !== undefined ? vehicleNameType : (driver.vehicleNameType || ''),
      licenseNumber: licenseNumber !== undefined ? licenseNumber : (driver.licenseNumber || ''),
      licenseExpiry: licenseExpiry !== undefined ? licenseExpiry : (driver.licenseExpiry || ''),
      emergencyContact: emergencyContact !== undefined ? emergencyContact : (driver.emergencyContact || ''),
      status: status !== undefined ? status : driver.status
    };

    await saveDriver(updatedDriver);

    // Update associated user
    const user = await getUser(id);
    if (user) {
      user.name = name !== undefined ? name : user.name;
      user.phone = phone !== undefined ? phone : user.phone;
      user.vehiclePlate = vehiclePlate !== undefined ? vehiclePlate : user.vehiclePlate;
      if (email !== undefined) {
        user.email = email.toLowerCase();
      }
      if (password !== undefined && password !== '') {
        user.password = password;
      }
      await saveUser(user);
    }

    return res.json(updatedDriver);
  } catch (error: any) {
    console.error(`Error updating driver ${id}:`, error);
    return res.status(500).json({ error: 'Failed to update driver details: ' + error.message });
  }
});

// DELETE: Delete driver (from Admin interface)
app.delete('/api/drivers/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const driver = await getDriver(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    await deleteDriver(id);
    await deleteUser(id);
    await deleteLocationLogsForDriver(id);
    await deleteTripReportsForDriver(id);

    return res.json({ success: true, message: 'Driver deleted successfully' });
  } catch (error) {
    console.error(`Error deleting driver ${id}:`, error);
    return res.status(500).json({ error: 'Failed to delete driver and associated resources.' });
  }
});

// GET: Specific driver details
app.get('/api/drivers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await getDriver(id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    const activeReport = await getActiveTripReport(id);
    driver.status = activeReport ? 'active' : 'offline';
    return res.json(driver);
  } catch (error) {
    console.error(`Error getting driver ${id}:`, error);
    return res.status(500).json({ error: 'Failed to load driver details.' });
  }
});

// POST: Update real-time coordinates of a driver
app.post('/api/location', async (req, res) => {
  const { driverId, latitude, longitude, speed } = req.body;
  if (!driverId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'driverId, latitude, and longitude are required' });
  }

  try {
    // A driver must have started duty (active/ongoing trip report) to be tracked
    const activeReport = await getActiveTripReport(driverId);
    if (!activeReport) {
      // Keep/Set driver status to offline if they try to send location but have not started duty
      const driver = await getDriver(driverId);
      if (driver && driver.status !== 'offline') {
        driver.status = 'offline';
        await saveDriver(driver);
      }
      return res.status(400).json({ error: 'GPS tracking is disabled. You must start duty first.' });
    }

    const driver = await getDriver(driverId);
    const timestamp = new Date().toISOString();

    if (driver) {
      driver.lastLatitude = latitude;
      driver.lastLongitude = longitude;
      driver.status = 'active';
      driver.lastActive = timestamp;
      await saveDriver(driver);
    }

    // Create log entry
    const logEntry = {
      id: 'log_' + Math.random().toString(36).substring(2, 11),
      driverId,
      latitude,
      longitude,
      speed: speed || 0,
      timestamp
    };
    await saveLocationLog(logEntry);

    // Update distance, speeds, and running stats on any active trip report
    if (activeReport) {
      activeReport.distanceKm = Number((activeReport.distanceKm + 0.05).toFixed(2));
      
      const currentSpeed = speed || 0;
      const maxSpeed = activeReport.maxSpeed !== undefined ? Math.max(activeReport.maxSpeed, currentSpeed) : currentSpeed;
      const speedCount = (activeReport.speedCount || 0) + 1;
      const speedSum = (activeReport.speedSum || 0) + currentSpeed;
      const avgSpeed = Number((speedSum / speedCount).toFixed(1));
      
      activeReport.maxSpeed = maxSpeed;
      activeReport.avgSpeed = avgSpeed;
      activeReport.speedCount = speedCount;
      activeReport.speedSum = speedSum;
      
      await saveTripReport(activeReport);
    }

    return res.json({ success: true, lastLocation: logEntry });
  } catch (error) {
    console.error('Error updating location:', error);
    return res.status(500).json({ error: 'Failed to broadcast location telemetry.' });
  }
});

// GET: Location logs for a specific driver
app.get('/api/locations/:driverId', async (req, res) => {
  const { driverId } = req.params;
  try {
    const logs = await getLocationLogs();
    const filtered = logs
      .filter(log => log.driverId === driverId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return res.json(filtered);
  } catch (error) {
    console.error(`Error fetching driver locations for ${driverId}:`, error);
    return res.status(500).json({ error: 'Failed to fetch driver telemetry.' });
  }
});

// GET: All location logs (useful for trace tracking)
app.get('/api/locations', async (req, res) => {
  try {
    const logs = await getLocationLogs();
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return res.status(500).json({ error: 'Failed to fetch telemetry tracks.' });
  }
});

// GET: Trip reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await getTripReports();
    return res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ error: 'Failed to fetch historical shift reports.' });
  }
});

// DELETE: Delete a trip report
app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteTripReport(id);
    return res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (error) {
    console.error(`Error deleting report ${id}:`, error);
    return res.status(500).json({ error: 'Failed to delete the report.' });
  }
});

// POST: Start a trip/shift (from driver)
app.post('/api/reports/start', async (req, res) => {
  const { driverId, driverName, vehiclePlate, startLocation } = req.body;
  if (!driverId || !driverName) {
    return res.status(400).json({ error: 'Driver info is required' });
  }

  try {
    // End any currently ongoing trips for this driver
    await endOngoingTrips(driverId);

    const newReport = {
      id: 'rep_' + Math.random().toString(36).substring(2, 11),
      driverId,
      driverName,
      vehiclePlate: vehiclePlate || '',
      date: new Date().toLocaleDateString(),
      startTime: new Date().toISOString(),
      endTime: null,
      startLocation: startLocation || 'Current Coordinates',
      endLocation: null,
      distanceKm: 0,
      status: 'ongoing' as const
    };

    await saveTripReport(newReport);

    // Set driver status to active
    const driver = await getDriver(driverId);
    if (driver) {
      driver.status = 'active';
      driver.lastActive = new Date().toISOString();
      await saveDriver(driver);
    }

    return res.status(201).json(newReport);
  } catch (error) {
    console.error('Error starting trip:', error);
    return res.status(500).json({ error: 'Failed to start shift logging.' });
  }
});

// POST: Stop a trip/shift (from driver)
app.post('/api/reports/stop', async (req, res) => {
  const { driverId, endLocation } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: 'driverId is required' });
  }

  try {
    const activeReport = await getActiveTripReport(driverId);
    if (!activeReport) {
      return res.status(404).json({ error: 'No active trip found for this driver' });
    }

    const completedReport = {
      ...activeReport,
      status: 'completed' as const,
      endTime: new Date().toISOString(),
      endLocation: endLocation || 'Current Coordinates'
    };

    await saveTripReport(completedReport);

    // Set driver status to offline
    const driver = await getDriver(driverId);
    if (driver) {
      driver.status = 'offline';
      driver.lastActive = new Date().toISOString();
      await saveDriver(driver);
    }

    return res.json(completedReport);
  } catch (error) {
    console.error('Error stopping trip:', error);
    return res.status(500).json({ error: 'Failed to terminate shift logging.' });
  }
});

// GET: Current user profile
app.get('/api/profile/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await getUser(id);
    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(`Error loading profile ${id}:`, error);
    return res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

// PUT: Update profile
app.put('/api/profile/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, vehiclePlate } = req.body;
  
  try {
    const user = await getUser(id);
    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.vehiclePlate = vehiclePlate || user.vehiclePlate;

    await saveUser(user);

    // Sync with driver details if it is a driver
    if (user.role === 'driver') {
      const driver = await getDriver(id);
      if (driver) {
        driver.name = user.name;
        driver.phone = user.phone || '';
        driver.vehiclePlate = user.vehiclePlate || '';
        await saveDriver(driver);
      }
    }

    return res.json(user);
  } catch (error) {
    console.error(`Error updating profile ${id}:`, error);
    return res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// ==========================================
// VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  // Seed database with default admin account if it is empty
  await seedDatabaseIfEmpty();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
