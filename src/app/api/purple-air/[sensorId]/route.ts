import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// In-memory storage for rate limiting
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Cache storage
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 300_000; // 5 minutes in milliseconds
const MAX_REQUESTS = 10;

// Cache configuration
const CACHE_DURATION = 1_800_000; // 30 minutes in milliseconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRateLimit = rateLimit.get(ip);

  if (!userRateLimit) {
    rateLimit.set(ip, { count: 1, timestamp: now });
    return true;
  }

  // Reset rate limit if window has passed
  if (now - userRateLimit.timestamp > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { count: 1, timestamp: now });
    return true;
  }

  // Increment count if within window
  if (userRateLimit.count < MAX_REQUESTS) {
    rateLimit.set(ip, {
      count: userRateLimit.count + 1,
      timestamp: userRateLimit.timestamp,
    });
    return true;
  }

  return false;
}

function getCachedData(sensorId: string) {
  const cachedItem = cache.get(sensorId);
  if (!cachedItem) return null;

  // Check if cache is still valid
  if (Date.now() - cachedItem.timestamp < CACHE_DURATION) {
    return cachedItem.data;
  }

  // Remove expired cache
  cache.delete(sensorId);
  return null;
}

function setCachedData(sensorId: string, data: any) {
  cache.set(sensorId, {
    data,
    timestamp: Date.now(),
  });
}

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();

  // Clean up rate limit entries
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }

  // Clean up cache entries
  for (const [sensorId, data] of cache.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      cache.delete(sensorId);
    }
  }
}, 300_000); // Run cleanup every 5 minutes

export async function GET(request: Request, { params }: { params: { sensorId: string } }) {
  // Get headers and params asynchronously
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const { sensorId } = params;

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
  }

  try {
    // Check cache first
    const cachedData = getCachedData(sensorId);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // If no cached data, fetch from PurpleAir
    const response = await fetch(`https://api.purpleair.com/v1/sensors/${sensorId}`, {
      headers: {
        'X-API-Key': process.env.PURPLE_AIR_API_KEY || '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const data = await response.json();

    // Cache the new data
    setCachedData(sensorId, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json({ error: 'Failed to fetch sensor data' }, { status: 500 });
  }
}
