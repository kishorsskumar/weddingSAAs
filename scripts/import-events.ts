import XLSX from 'xlsx';
import { db } from '../server/db';
import { events } from '../shared/schema';

async function importEvents() {
  const workbook = XLSX.readFile('attached_assets/FY_25-26_Booking_for_uploading_1764866261216.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

  console.log('Parsing Excel file...');
  console.log('Total rows:', data.length);

  const eventsToImport: any[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[];
    if (!row || !row[1]) continue;

    const dateStr = row[1];
    const eventName = row[2]?.toString().trim() || '';
    const clientName = row[3]?.toString().trim() || '';
    const eventType = row[4]?.toString().trim() || 'Other';
    const venue = row[5]?.toString().trim() || 'TBD';
    const plannedCost = row[6]?.toString().replace(/[^0-9.]/g, '') || '0';
    const actualCost = row[7]?.toString().replace(/[^0-9.]/g, '') || '0';
    const plannerShort = row[9]?.toString().trim() || '';

    const planner = plannerShort === 'Fida' ? 'Fida Fathima' :
                    plannerShort === 'Femina' ? 'Femina KM' : plannerShort;

    const parsedDate = parseDate(dateStr);
    if (!parsedDate) {
      console.log('Skipping row with invalid date:', dateStr);
      continue;
    }

    const customer = clientName || eventName || 'Unknown';
    const dateForTitle = parsedDate.toUpperCase().replace(/-/g, '');
    const title = `${customer.toUpperCase().replace(/\s+/g, '-')}-${venue.toUpperCase().replace(/\s+/g, '-')}-${dateForTitle.slice(-5)}`;

    eventsToImport.push({
      title: title.substring(0, 50),
      date: parsedDate,
      type: eventType || 'Other',
      planner: planner || 'TBD',
      customer: customer,
      venue: venue || 'TBD',
      salesValue: parseFloat(plannedCost) || 0,
      paymentReceived: 0,
      cost: parseFloat(actualCost) || 0,
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
    console.log(`- ${e.customer} | ${e.date} | ${e.type} | ${e.venue} | Planner: ${e.planner}`);
  });
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const months: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const match = dateStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    const year = '20' + match[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

importEvents()
  .then(() => {
    console.log('\nImport completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
