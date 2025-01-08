'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface PurpleAirDisplayProps {
  sensorId: string;
}

interface AQIData {
  pm25: number;
  aqi: number;
  category: string;
  colorClass: string;
  temperature: number;
  humidity: number;
}

export default function PurpleAirDisplay({ sensorId }: PurpleAirDisplayProps) {
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Your existing functions with TypeScript types
  const calculateAQI = (pm25: number): number => {
    if (pm25 <= 12.0) return Math.round((50 / 12.0) * pm25);
    if (pm25 <= 35.4) return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
    if (pm25 <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
    return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  };

  const getAQICategory = (aqi: number) => {
    if (aqi <= 50) return { category: 'Good', color: 'bg-green-500' };
    if (aqi <= 100) return { category: 'Moderate', color: 'bg-yellow-500' };
    if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: 'bg-orange-500' };
    if (aqi <= 200) return { category: 'Unhealthy', color: 'bg-red-500' };
    return { category: 'Very Unhealthy', color: 'bg-purple-500' };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/purple-air/${sensorId}`);

        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();
        const pm25 = data.sensor.stats['pm2.5_10minute'];
        const aqi = calculateAQI(pm25);
        const category = getAQICategory(aqi);

        setAqiData({
          pm25,
          aqi,
          category: category.category,
          colorClass: category.color,
          temperature: data.sensor.temperature,
          humidity: data.sensor.humidity,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [sensorId]);

  if (loading) {
    return (
      <Card className='w-full max-w-md'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className='w-full max-w-md'>
        <CardContent className='p-6'>
          <div className='flex items-center space-x-2 text-red-500'>
            <AlertCircle className='h-5 w-5' />
            <span>Error loading air quality data: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-md'>
      <CardHeader>
        <CardTitle className='text-xl font-bold'>Air Quality Monitor</CardTitle>
      </CardHeader>
      <CardContent>
        {aqiData && (
          <div className='space-y-4'>
            <div className={`p-4 rounded-lg ${aqiData.colorClass} text-white`}>
              <div className='text-3xl font-bold text-center'>{aqiData.aqi}</div>
              <div className='text-center'>{aqiData.category}</div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='p-4 bg-gray-100 rounded-lg dark:bg-gray-800'>
                <div className='text-sm text-gray-600 dark:text-gray-400'>PM2.5</div>
                <div className='text-xl font-semibold'>{aqiData.pm25.toFixed(1)} µg/m³</div>
              </div>

              <div className='p-4 bg-gray-100 rounded-lg dark:bg-gray-800'>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Temperature</div>
                <div className='text-xl font-semibold'>{aqiData.temperature.toFixed(1)}°F</div>
              </div>

              <div className='p-4 bg-gray-100 rounded-lg dark:bg-gray-800'>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Humidity</div>
                <div className='text-xl font-semibold'>{aqiData.humidity.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
