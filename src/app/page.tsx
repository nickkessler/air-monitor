import PurpleAirDisplay from '@/components/PurpleAirDisplay';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-24'>
      <PurpleAirDisplay sensorId='68657' />
    </main>
  );
}
