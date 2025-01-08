import { NextRequest, NextResponse } from 'next/server';

// Define types for our data structures
interface RateLimitEntry {
  count: number;
  timestamp: number;
}

interface CacheEntry {
  data: PurpleAirData;
  timestamp: number;
}

interface PurpleAirData {
  sensor: {
    stats: {
      'pm2.5_10minute': number;
    };
    temperature: number;
    humidity: number;
  };
}

// In-memory storage for rate limiting
const rateLimit = new Map<string, RateLimitEntry>();

// Cache storage
const cache = new Map<string, CacheEntry>();

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

function getCachedData(sensorId: string): PurpleAirData | null {
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

function setCachedData(sensorId: string, data: PurpleAirData): void {
  // Clean up old entries before setting new ones
  const now = Date.now();

  // Clean up rate limit entries
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }

  // Clean up cache entries
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }

  // Set new cache entry
  cache.set(sensorId, {
    data,
    timestamp: now,
  });
}

type Props = {
  params: Promise<{
    sensorId: string;
  }>;
};

export async function GET(request: NextRequest, props: Props): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  const { sensorId } = await props.params;

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

    const data = (await response.json()) as PurpleAirData;

    // Cache the new data
    setCachedData(sensorId, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return NextResponse.json({ error: 'Failed to fetch sensor data' }, { status: 500 });
  }
}
