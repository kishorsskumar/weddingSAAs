import * as fs from 'fs';
import { db } from '../server/db';
import { events } from '../shared/schema';

async function importCSV() {
  const csvContent = fs.readFileSync('attached_assets/FY_25-26_Booking_for_uploading_to_Calendar_website_CSV_1764867327844.csv', 'utf-8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  console.log('Headers:', headers);
  console.log('Total data rows:', lines.length - 1);

  const eventsToImport: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const id = values[0];
    const date = values[1];
    const planner = values[5] === 'Fida' ? 'Fida Fathima' : values[5] === 'Femina' ? 'Femina KM' : values[5];
    const customer = values[6]?.trim() || 'Unknown';
    const eventType = values[7]?.trim() || 'Other';
    const venue = values[8]?.trim() || 'TBD';
    const salesValue = parseFloat(values[9]?.replace(/[^0-9.]/g, '') || '0');
    const paymentReceived = parseFloat(values[10]?.replace(/[^0-9.]/g, '') || '0');

    const dateForTitle = date.replace(/-/g, '').slice(-6);
    const title = `${customer.toUpperCase().replace(/\s+/g, '-').substring(0, 15)}-${venue.toUpperCase().replace(/\s+/g, '-').substring(0, 10)}-${dateForTitle}`;

    eventsToImport.push({
      title: title.substring(0, 50),
      date: date,
      type: eventType || 'Other',
      planner: planner || 'TBD',
      customer: customer,
      venue: venue || 'TBD',
      salesValue: salesValue.toString(),
      paymentReceived: paymentReceived.toString(),
      cost: '0',
    });
  }

  console.log('\nEvents to import:', eventsToImport.length);

  await db.delete(events);
  console.log('Cleared existing events.');

  for (const event of eventsToImport) {
    await db.insert(events).values(event);
  }

  console.log('Successfully imported', eventsToImport.length, 'events!');

  console.log('\nSample imported events:');
  eventsToImport.slice(0, 5).forEach(e => {
    console.log(`- ${e.customer} | ${e.date} | Sales: ₹${Number(e.salesValue).toLocaleString()} | Received: ₹${Number(e.paymentReceived).toLocaleString()}`);
  });

  const totalSales = eventsToImport.reduce((sum, e) => sum + Number(e.salesValue), 0);
  const totalReceived = eventsToImport.reduce((sum, e) => sum + Number(e.paymentReceived), 0);
  console.log('\nTotals:');
  console.log(`- Total Sales Value: ₹${totalSales.toLocaleString()}`);
  console.log(`- Total Payment Received: ₹${totalReceived.toLocaleString()}`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

importCSV()
  .then(() => {
    console.log('\nImport completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
