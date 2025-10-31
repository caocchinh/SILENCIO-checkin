/**
 * Standalone Ably Worker Process
 * 
 * This is a long-running Node.js process that handles Ably real-time subscriptions
 * independently from the Next.js serverless functions.
 * 
 * Deploy this to Railway, Render, or DigitalOcean for reliable 24/7 operation.
 */

const Ably = require('ably');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

// Environment variables validation
const REQUIRED_ENV_VARS = [
  'ABLY_API_KEY',
  'DATABASE_URL',
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Configuration
const RETRY_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  maxAttempts: 10,
  backoffMultiplier: 2,
};

const HEALTH_CHECK_INTERVAL = 600000; // 600 seconds
const HEALTH_CHECK_PORT = process.env.PORT || 3001;

// State management
const state = {
  isRunning: false,
  startTime: Date.now(),
  lastHealthCheck: 0,
  connectionState: 'initializing',
  subscriptionCount: 0,
  retryAttempts: 0,
  lastError: null,
  requestsProcessed: 0,
  requestsFailed: 0,
};

let ablyClient = null;
let dbPool = null;
let activeSubscriptions = [];
let healthCheckTimer = null;
let shutdownInProgress = false;

// Channel configuration
const CHANNELS = {
  QR_SCAN_REQUESTS: 'qr-scan-requests',
  QR_SCAN_RESPONSES: 'qr-scan-responses',
  CHECKIN_REQUESTS: 'checkin-requests',
  CHECKIN_RESPONSES: 'checkin-responses',
  CUSTOMER_UPDATES: 'customer-updates',
};

const EVENT_NAMES = {
  SCAN_REQUEST: 'scan_request',
  SCAN_RESPONSE: 'scan_response',
  CHECKIN_REQUEST: 'checkin_request',
  CHECKIN_RESPONSE: 'checkin_response',
  CHECKED_IN: 'checked_in',
};

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function getRetryDelay(attempt) {
  const delay = Math.min(
    RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelay
  );
  return delay + Math.random() * 1000;
}

/**
 * Initialize database connection pool
 */
function initializeDatabase() {
  if (dbPool) return dbPool;
  
  dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('✅ Database pool initialized');
  return dbPool;
}

/**
 * Database helper: Get customer info by session ID
 */
async function getCustomerInfoBySession(sessionId) {
  try {
    // First get the user email from the session
    const sessionResult = await dbPool.query(
      `SELECT s.user_id, u.email
       FROM session s
       JOIN "user" u ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return {
        success: false,
        error: 'Session not found or expired',
        code: 'customer-session-expired',
      };
    }

    const userEmail = sessionResult.rows[0].email;

    // Then get the customer by email with queue information
    const customerResult = await dbPool.query(
      `SELECT 
         c.student_id, 
         c.name, 
         c.email, 
         c.homeroom, 
         c.ticket_type, 
         c.has_checked_in, 
         c.created_at,
         q.haunted_house_name,
         q.queue_number,
         q.queue_start_time,
         q.queue_end_time
       FROM customer c
       LEFT JOIN queue_spot qs ON c.student_id = qs.customer_id
       LEFT JOIN queue q ON qs.queue_id = q.id
       WHERE c.email = $1`,
      [userEmail]
    );

    if (customerResult.rows.length === 0) {
      return {
        success: false,
        error: 'No customer record found for this session',
        code: 'does-not-have-ticket',
      };
    }

    // Format the response with camelCase field names
    const customer = customerResult.rows[0];
    return {
      success: true,
      data: {
        studentId: customer.student_id,
        name: customer.name,
        email: customer.email,
        homeroom: customer.homeroom,
        ticketType: customer.ticket_type,
        hasCheckedIn: customer.has_checked_in,
        hauntedHouseName: customer.haunted_house_name || null,
        queueNumber: customer.queue_number || null,
        queueStartTime: customer.queue_start_time || null,
        queueEndTime: customer.queue_end_time || null,
      },
    };
  } catch (error) {
    console.error('Database error in getCustomerInfoBySession:', error);
    return {
      success: false,
      error: error.message,
      code: 'database-error',
    };
  }
}

/**
 * Database helper: Check in customer
 */
async function checkInCustomer(customerId) {
  console.log(`🔍 [Check-in] Starting check-in process for customer: ${customerId}`);
  
  try {
    // Check if customer exists and hasn't checked in yet
    console.log(`📊 [Check-in] Querying database for customer: ${customerId}`);
    const checkResult = await dbPool.query(
      `SELECT student_id, has_checked_in, name FROM customer WHERE student_id = $1`,
      [customerId]
    );

    if (checkResult.rows.length === 0) {
      console.warn(`⚠️ [Check-in] Customer not found: ${customerId}`);
      return {
        success: false,
        error: 'Customer not found',
        code: 'not-found',
      };
    }

    const customer = checkResult.rows[0];
    console.log(`✅ [Check-in] Customer found: ${customer.name} (${customer.student_id}), hasCheckedIn: ${customer.has_checked_in}`);
    
    if (customer.has_checked_in) {
      console.warn(`⚠️ [Check-in] Customer already checked in: ${customer.name} (${customer.student_id})`);
      return {
        success: false,
        error: 'Customer has already checked in',
        code: 'customer-already-checked-in',
      };
    }

    // Perform check-in
    console.log(`💾 [Check-in] Updating check-in status for: ${customer.name} (${customer.student_id})`);
    const updateResult = await dbPool.query(
      `UPDATE customer 
       SET has_checked_in = true
       WHERE student_id = $1 AND has_checked_in = false
       RETURNING student_id, name, has_checked_in`,
      [customerId]
    );

    if (updateResult.rows.length === 0) {
      console.error(`❌ [Check-in] Race condition - customer already checked in during update: ${customer.student_id}`);
      return {
        success: false,
        error: 'Customer has already checked in',
        code: 'customer-already-checked-in',
      };
    }

    console.log(`🎉 [Check-in] Successfully checked in: ${updateResult.rows[0].name} (${updateResult.rows[0].student_id})`);
    return {
      success: true,
      data: updateResult.rows[0],
    };
  } catch (error) {
    console.error(`❌ [Check-in] Database error for customer ${customerId}:`, error);
    console.error(`❌ [Check-in] Error stack:`, error.stack);
    return {
      success: false,
      error: error.message,
      code: 'database-error',
    };
  }
}

/**
 * Clean up all resources
 */
async function cleanup() {
  console.log('🧹 Cleaning up resources...');
  
  // Unsubscribe from all channels
  for (const unsubscribe of activeSubscriptions) {
    try {
      await unsubscribe();
    } catch (error) {
      console.error('Error during unsubscribe:', error);
    }
  }
  activeSubscriptions = [];
  
  // Clear health check timer
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  // Close Ably connection
  if (ablyClient) {
    try {
      await ablyClient.close();
      console.log('✅ Ably connection closed');
    } catch (error) {
      console.error('Error closing Ably:', error);
    }
    ablyClient = null;
  }
  
  // Close database pool
  if (dbPool) {
    try {
      await dbPool.end();
      console.log('✅ Database pool closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
    dbPool = null;
  }
  
  state.isRunning = false;
  state.subscriptionCount = 0;
  state.connectionState = 'disconnected';
}

/**
 * Start health monitoring
 */
function startHealthMonitoring() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  
  healthCheckTimer = setInterval(() => {
    if (!ablyClient || shutdownInProgress) return;
    
    const connectionState = ablyClient.connection.state;
    state.lastHealthCheck = Date.now();
    state.connectionState = connectionState;
    
    const uptime = Math.floor((Date.now() - state.startTime) / 1000);
    console.log(`[Health Check] State: ${connectionState}, Subscriptions: ${state.subscriptionCount}, Uptime: ${uptime}s, Processed: ${state.requestsProcessed}, Failed: ${state.requestsFailed}`);
    
    // Auto-recovery for bad connection states
    if (connectionState === 'failed' || connectionState === 'suspended') {
      console.warn(`⚠️ Connection ${connectionState}, attempting recovery...`);
      state.lastError = `Connection ${connectionState}`;
      
      setTimeout(() => {
        if (!shutdownInProgress) {
          reinitialize();
        }
      }, getRetryDelay(state.retryAttempts));
    } else if (connectionState === 'connected') {
      state.retryAttempts = 0;
      state.lastError = null;
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Setup connection monitoring
 */
function setupConnectionMonitoring(client) {
  client.connection.on('connected', () => {
    console.log('✅ Ably connected');
    state.connectionState = 'connected';
    state.retryAttempts = 0;
    state.lastError = null;
  });
  
  client.connection.on('disconnected', () => {
    console.warn('⚠️ Ably disconnected');
    state.connectionState = 'disconnected';
  });
  
  client.connection.on('suspended', () => {
    console.error('❌ Ably connection suspended');
    state.connectionState = 'suspended';
    state.lastError = 'Connection suspended';
  });
  
  client.connection.on('failed', () => {
    console.error('❌ Ably connection failed');
    state.connectionState = 'failed';
    state.lastError = 'Connection failed';
    
    if (state.retryAttempts < RETRY_CONFIG.maxAttempts && !shutdownInProgress) {
      state.retryAttempts++;
      const delay = getRetryDelay(state.retryAttempts);
      console.log(`⏳ Retrying in ${delay}ms (attempt ${state.retryAttempts}/${RETRY_CONFIG.maxAttempts})`);
      
      setTimeout(() => {
        if (!shutdownInProgress) {
          reinitialize();
        }
      }, delay);
    } else {
      console.error('❌ Max retry attempts reached');
      state.lastError = 'Max retry attempts exceeded';
    }
  });
  
  client.connection.on('update', (stateChange) => {
    console.log(`Connection: ${stateChange.previous} → ${stateChange.current}`);
    state.connectionState = stateChange.current;
  });
}

/**
 * Reinitialize the worker
 */
async function reinitialize() {
  console.log('🔄 Reinitializing worker...');
  await cleanup();
  await initialize();
}

/**
 * Initialize Ably subscriptions
 */
async function initialize() {
  if (state.isRunning || shutdownInProgress) {
    console.log('Worker already running or shutting down');
    return;
  }
  
  try {
    console.log('🚀 Initializing Ably worker...');
    
    // Initialize database
    initializeDatabase();
    
    // Initialize Ably client
    ablyClient = new Ably.Realtime({
      key: process.env.ABLY_API_KEY,
      autoConnect: true,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 5000,
      recover: (lastConnectionDetails, callback) => {
        callback(true);
      },
    });
    
    // Setup connection monitoring
    setupConnectionMonitoring(ablyClient);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);
      
      if (ablyClient.connection.state === 'connected') {
        clearTimeout(timeout);
        resolve();
      } else {
        ablyClient.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        ablyClient.connection.once('failed', () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        });
      }
    });
    
    console.log('✅ Ably connection established');
    
    // Get channels
    const scanRequestChannel = ablyClient.channels.get(CHANNELS.QR_SCAN_REQUESTS);
    const scanResponseChannel = ablyClient.channels.get(CHANNELS.QR_SCAN_RESPONSES);
    const checkinRequestChannel = ablyClient.channels.get(CHANNELS.CHECKIN_REQUESTS);
    const checkinResponseChannel = ablyClient.channels.get(CHANNELS.CHECKIN_RESPONSES);
    
    // Subscribe to QR scan requests
    await scanRequestChannel.subscribe(EVENT_NAMES.SCAN_REQUEST, async (message) => {
      const request = message.data;
      console.log(`📱 Processing QR scan: ${request.requestId}`);
      
      try {
        const result = await getCustomerInfoBySession(request.sessionId);
        
        const response = {
          type: 'scan_response',
          requestId: request.requestId,
          success: result.success,
          data: result.data,
          error: result.error,
          code: result.code,
          timestamp: Date.now(),
        };
        
        console.log(`📤 Publishing response on channel: ${CHANNELS.QR_SCAN_RESPONSES}, event: ${EVENT_NAMES.SCAN_RESPONSE}`);
        console.log(`📦 Response data:`, JSON.stringify(response, null, 2));
        
        await scanResponseChannel.publish(EVENT_NAMES.SCAN_RESPONSE, response);
        state.requestsProcessed++;
        console.log(`✅ QR scan response sent: ${request.requestId}`);
      } catch (error) {
        console.error('❌ Error processing QR scan:', error);
        state.requestsFailed++;
        state.lastError = error.message;
        
        try {
          await scanResponseChannel.publish(EVENT_NAMES.SCAN_RESPONSE, {
            type: 'scan_response',
            requestId: request.requestId,
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });
        } catch (publishError) {
          console.error('Failed to publish error response:', publishError);
        }
      }
    });
    
    activeSubscriptions.push(() => scanRequestChannel.unsubscribe());
    state.subscriptionCount++;
    
    // Subscribe to check-in requests
    await checkinRequestChannel.subscribe(EVENT_NAMES.CHECKIN_REQUEST, async (message) => {
      const request = message.data;
      console.log(`📥 [Check-in Handler] Received check-in request:`, {
        requestId: request.requestId,
        customerId: request.customerId,
        timestamp: new Date(request.timestamp).toISOString(),
      });
      
      try {
        const startTime = Date.now();
        const result = await checkInCustomer(request.customerId);
        const processingTime = Date.now() - startTime;
        
        const response = {
          type: 'checkin_response',
          requestId: request.requestId,
          success: result.success,
          data: result.data,
          error: result.error,
          code: result.code,
          timestamp: Date.now(),
        };
        
        console.log(`📤 [Check-in Handler] Publishing response on channel: ${CHANNELS.CHECKIN_RESPONSES}`, {
          requestId: request.requestId,
          success: result.success,
          code: result.code,
          processingTime: `${processingTime}ms`,
        });
        
        await checkinResponseChannel.publish(EVENT_NAMES.CHECKIN_RESPONSE, response);
        state.requestsProcessed++;
        
        if (result.success) {
          console.log(`✅ [Check-in Handler] Check-in successful for ${result.data?.name || request.customerId} (${request.requestId})`);
          
          // Publish to CUSTOMER_UPDATES channel for real-time UI updates
          try {
            const customerUpdatesChannel = ablyClient.channels.get(CHANNELS.CUSTOMER_UPDATES);
            await customerUpdatesChannel.publish(EVENT_NAMES.CHECKED_IN, {
              studentId: request.customerId,
              hasCheckedIn: true,
            });
            console.log(`📢 [Check-in Handler] Published customer update for ${request.customerId}`);
          } catch (publishError) {
            console.error(`❌ [Check-in Handler] Failed to publish customer update:`, publishError);
            // Don't fail the check-in if publishing to customer updates fails
          }
        } else {
          console.warn(`⚠️ [Check-in Handler] Check-in failed: ${result.code} - ${result.error} (${request.requestId})`);
        }
      } catch (error) {
        console.error(`❌ [Check-in Handler] Error processing check-in request ${request.requestId}:`, error);
        console.error(`❌ [Check-in Handler] Error details:`, {
          customerId: request.customerId,
          errorMessage: error.message,
          errorStack: error.stack,
        });
        state.requestsFailed++;
        state.lastError = error.message;
        
        try {
          await checkinResponseChannel.publish(EVENT_NAMES.CHECKIN_RESPONSE, {
            type: 'checkin_response',
            requestId: request.requestId,
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });
          console.log(`📤 [Check-in Handler] Error response published for ${request.requestId}`);
        } catch (publishError) {
          console.error(`❌ [Check-in Handler] Failed to publish error response for ${request.requestId}:`, publishError);
        }
      }
    });
    
    activeSubscriptions.push(() => checkinRequestChannel.unsubscribe());
    state.subscriptionCount++;
    
    state.isRunning = true;
    state.lastHealthCheck = Date.now();
    state.retryAttempts = 0;
    state.lastError = null;
    
    // Start health monitoring
    startHealthMonitoring();
    
    console.log(`✅ Worker initialized with ${state.subscriptionCount} subscriptions`);
  } catch (error) {
    console.error('❌ Failed to initialize worker:', error);
    state.lastError = error.message;
    
    await cleanup();
    
    if (state.retryAttempts < RETRY_CONFIG.maxAttempts && !shutdownInProgress) {
      state.retryAttempts++;
      const delay = getRetryDelay(state.retryAttempts);
      console.log(`⏳ Retrying in ${delay}ms (attempt ${state.retryAttempts}/${RETRY_CONFIG.maxAttempts})`);
      
      setTimeout(() => {
        if (!shutdownInProgress) {
          initialize();
        }
      }, delay);
    } else {
      console.error('❌ Max retry attempts reached. Exiting.');
      process.exit(1);
    }
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (shutdownInProgress) {
    console.log('Shutdown already in progress...');
    return;
  }
  
  console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
  shutdownInProgress = true;
  
  // Stop accepting new requests
  state.isRunning = false;
  
  // Give ongoing requests time to complete
  console.log('⏳ Waiting for ongoing requests to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Clean up resources
  await cleanup();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

/**
 * Simple HTTP health check server
 */
function startHealthCheckServer() {
  const http = require('http');
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const uptime = Math.floor((Date.now() - state.startTime) / 1000);
      const healthStatus = {
        status: state.isRunning ? 'healthy' : 'unhealthy',
        uptime,
        connectionState: state.connectionState,
        subscriptions: state.subscriptionCount,
        requestsProcessed: state.requestsProcessed,
        requestsFailed: state.requestsFailed,
        lastHealthCheck: state.lastHealthCheck,
        lastError: state.lastError,
        retryAttempts: state.retryAttempts,
      };
      
      const statusCode = state.isRunning && state.connectionState === 'connected' ? 200 : 503;
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthStatus, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(HEALTH_CHECK_PORT, () => {
    console.log(`🏥 Health check server running on port ${HEALTH_CHECK_PORT}`);
    console.log(`   Access at: http://localhost:${HEALTH_CHECK_PORT}/health`);
  });
}

// Setup signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  state.lastError = error.message;
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  state.lastError = reason instanceof Error ? reason.message : String(reason);
});

// Start the worker
console.log('🎬 Starting Ably Worker...');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Health check port: ${HEALTH_CHECK_PORT}`);

startHealthCheckServer();
initialize().catch((error) => {
  console.error('❌ Fatal error during initialization:', error);
  process.exit(1);
});
